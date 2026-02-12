
import * as d3 from 'd3';
import type { OrgChartNodeData, OrgChartOptions } from './types';
import './styles.css';

export class OrgChart {
    private container: HTMLElement;
    private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private g!: d3.Selection<SVGGElement, unknown, null, undefined>;
    private nodeGroup!: d3.Selection<SVGGElement, unknown, null, undefined>;
    private linkGroup!: d3.Selection<SVGGElement, unknown, null, undefined>;
    private options: OrgChartOptions;

    private root: d3.HierarchyPointNode<OrgChartNodeData> | null = null;
    private treeLayout: d3.TreeLayout<OrgChartNodeData>;
    private rawData: OrgChartNodeData[] = [];

    // Layout Cache for Virtual Rendering
    private cachedNodes: d3.HierarchyPointNode<OrgChartNodeData>[] = [];
    private cachedLinks: d3.HierarchyLink<OrgChartNodeData>[] = [];

    // State
    private mode: 'view' | 'edit' = 'view';
    private zoomBehavior!: d3.ZoomBehavior<SVGSVGElement, unknown>;
    private selectedNodeId: string | null = null;
    private isFirstRender = true;
    private currentTransform: d3.ZoomTransform = d3.zoomIdentity;

    // Drag State
    private dropTarget: { type: 'reparent' | 'reorder', targetId: string, position?: 'before' | 'after' } | null = null;
    private ghostNode: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
    private dropIndicator: d3.Selection<SVGGraphicsElement, unknown, null, undefined> | null = null;

    // Config
    private nodeWidth: number;
    private nodeHeight: number;
    private animationDuration = 400;

    constructor(container: HTMLElement, options: OrgChartOptions) {
        this.container = container;
        this.options = options;
        this.nodeWidth = options.nodeWidth || 220;
        this.nodeHeight = options.nodeHeight || 100;

        this.initDOM();
        this.initZoom();

        // Initialize Tree Layout
        this.treeLayout = d3.tree<OrgChartNodeData>()
            .nodeSize([this.nodeWidth + (options.nodeSpacingX || 50), this.nodeHeight + (options.nodeSpacingY || 80)]);
    }

    private initDOM() {
        this.container.innerHTML = '';
        this.container.classList.add('org-chart-container');
        this.container.dataset.mode = this.mode;
        // Overflow hidden is important for container
        this.container.style.overflow = 'hidden';

        this.svg = d3.select(this.container).append('svg')
            .attr('class', 'org-chart-svg')
            .attr('width', '100%')
            .attr('height', '100%');

        this.g = this.svg.append('g');
        this.linkGroup = this.g.append('g').attr('class', 'links');
        this.nodeGroup = this.g.append('g').attr('class', 'nodes');
    }

    private initZoom() {
        this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 2])
            .on('zoom', (event) => {
                this.currentTransform = event.transform;
                this.g.attr('transform', event.transform);
                // Trigger virtual render on zoom/pan
                this.renderViewport();
            });

        // Disable double click zoom
        this.svg
            .call(this.zoomBehavior)
            .on("dblclick.zoom", null);
    }

    public render(data: OrgChartNodeData[]) {
        this.rawData = JSON.parse(JSON.stringify(data)); // Deep copy to avoid mutating source immediately

        // Stratify
        try {
            const rootHierarchy = d3.stratify<OrgChartNodeData>()
                .id(d => d.id)
                .parentId(d => d.parentId)
                (this.rawData);

            this.root = rootHierarchy as d3.HierarchyPointNode<OrgChartNodeData>;

            // Initial layout
            if (!this.root.x) {
                (this.root as any).x0 = 0;
                (this.root as any).y0 = 0;
            }

            // Initial Expansion Control (Keep this for logical initial state)
            if (this.isFirstRender && typeof this.options.defaultExpandDepth === 'number') {
                this.root.each((node) => {
                    if (node.depth >= this.options.defaultExpandDepth!) {
                        if (node.children) {
                            (node as any)._children = node.children;
                            node.children = undefined;
                        }
                    }
                });
            }

            this.updateLayout(this.root);

            if (this.isFirstRender) {
                this.resetView(false); // No animation for first render
                this.isFirstRender = false;
            }

        } catch (e) {
            console.error("Failed to stratify data", e);
        }
    }

    // New: Separated Layout Computation
    private updateLayout(source: any) {
        if (!this.root) return;

        // Compute layout using D3 Tree
        const treeData = this.treeLayout(this.root);
        this.cachedNodes = treeData.descendants();
        this.cachedLinks = treeData.links();

        // Normalize for fixed-depth (vertical spacing)
        this.cachedNodes.forEach(d => {
            d.y = d.depth * (this.nodeHeight + (this.options.nodeSpacingY || 80));
            // Store x0/y0 for transitions if needed (though virtual rendering makes transitions harder)
            // We keep standard transition logic for now, but apply it only to visible nodes
        });

        // After computing layout, render current viewport
        this.renderViewport(source);

        // Stash positions for transitions
        this.cachedNodes.forEach(d => {
            (d as any).x0 = d.x;
            (d as any).y0 = d.y;
        });
    }

    // New: Virtual Renderer
    private renderViewport(source?: any) {
        if (!this.root) return;

        // 1. Calculate Viewport Boundaries
        const containerRect = this.container.getBoundingClientRect();
        const t = this.currentTransform;

        // Viewport in SVG coordinates (inverse transform)
        // Add buffer (e.g., 200px) to pre-render nearby nodes
        const buffer = 300;
        const minX = (-t.x - buffer) / t.k;
        const maxX = (containerRect.width - t.x + buffer) / t.k;
        const minY = (-t.y - buffer) / t.k;
        const maxY = (containerRect.height - t.y + buffer) / t.k;

        // 2. Filter Nodes in Viewport
        const visibleNodes = this.cachedNodes.filter(d => {
            // Node center is d.x, d.y. Check if bounding box intersects.
            const x = d.x;
            const y = d.y;
            // Simple point check + dimension check
            return x >= minX - this.nodeWidth / 2 && x <= maxX + this.nodeWidth / 2 &&
                y >= minY && y <= maxY + this.nodeHeight;
        });

        // 3. Filter Links (if source or target is visible)
        // Optimization: render link if *either* node is visible
        const visibleLinks = this.cachedLinks.filter(l => {
            const sx = l.source.x;
            const sy = l.source.y;
            const tx = l.target.x;
            const ty = l.target.y;

            // Check if link bounding box overlaps viewport
            const lMinX = Math.min(sx, tx) - 50;
            const lMaxX = Math.max(sx, tx) + 50;
            const lMinY = Math.min(sy, ty) - 50;
            const lMaxY = Math.max(sy, ty) + 50;

            return !(lMaxX < minX || lMinX > maxX || lMaxY < minY || lMinY > maxY);
        });


        // --- Render Nodes ---
        const nodeSelection = this.nodeGroup.selectAll<SVGGElement, d3.HierarchyPointNode<OrgChartNodeData>>('g.org-chart-node')
            // Key function is crucial!!
            .data(visibleNodes, d => d.data.id);

        // EXIT
        nodeSelection.exit().remove();

        // ENTER
        const nodeEnter = nodeSelection.enter().append('g')
            .attr('class', 'org-chart-node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`)
            .attr('opacity', 1) // No fade-in for virtual scroll to avoid flickering
            .on('click', (_event, d) => {
                if (this.mode === 'view') {
                    if (this.selectedNodeId === d.data.id) {
                        this.setSelected(null);
                    } else {
                        this.setSelected(d.data.id);
                        if (this.options.onNodeClick) {
                            this.options.onNodeClick(d.data.id);
                        }
                    }
                }
            });

        const fo = nodeEnter.append('foreignObject')
            .attr('width', this.nodeWidth)
            .attr('height', this.nodeHeight)
            .attr('x', -this.nodeWidth / 2)
            .attr('y', 0);

        fo.append('xhtml:div')
            .style('width', '100%')
            .style('height', '100%')
            .attr('class', 'org-chart-node-content');

        // Collapse Button
        const collapseGroup = nodeEnter.append('g')
            .attr('class', 'org-chart-collapse-group')
            .attr('transform', `translate(0, ${this.nodeHeight + 10})`)
            .attr('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                if (d.children) {
                    (d as any)._children = d.children;
                    d.children = undefined;
                } else {
                    d.children = (d as any)._children;
                    (d as any)._children = undefined;
                }
                this.updateLayout(d); // Recompute and render
            });

        collapseGroup.append('circle').attr('class', 'org-chart-collapse-btn').attr('r', 8);
        collapseGroup.append('text').attr('class', 'org-chart-collapse-symbol').attr('text-anchor', 'middle').attr('dy', 4).style('font-size', '12px');

        // UPDATE (Merge)
        const nodeUpdate = nodeEnter.merge(nodeSelection as any);

        // Fast transform update (no transition for scroll, yes for layout?)
        // To simplify, we skip transitions for purely virtual scrolling. 
        // We only transition if positions changed significantly (layout update). 
        // But tracking that is hard. Let's just snap to position.
        nodeUpdate.attr('transform', d => `translate(${d.x}, ${d.y})`);

        nodeUpdate.each((d, i, n) => {
            const el = d3.select(n[i]).select('.org-chart-node-content').node() as HTMLElement;
            if (el) {
                // Optimization limit content re-rendering?
                // For now, simple re-render
                el.innerHTML = '';
                const content = this.options.renderContent(d.data);
                if (typeof content === 'string') {
                    el.innerHTML = content;
                } else {
                    el.appendChild(content);
                }
            }
        });

        nodeUpdate.classed('selected', d => d.data.id === this.selectedNodeId);

        nodeUpdate.select('.org-chart-collapse-group')
            .attr('display', (d) => (d.children || (d as any)._children) ? 'inline' : 'none');
        nodeUpdate.select('.org-chart-collapse-symbol')
            .text((d) => (d as any)._children ? '+' : '-');

        // Re-attach Drag (filter by edit mode)
        const drag = d3.drag<SVGGElement, d3.HierarchyPointNode<OrgChartNodeData>>()
            .filter(() => this.mode === 'edit')
            .on('start', this.onDragStart.bind(this))
            .on('drag', this.onDrag.bind(this))
            .on('end', this.onDragEnd.bind(this));

        nodeUpdate.call(drag as any);


        // --- Render Links ---
        const linkSelection = this.linkGroup.selectAll<SVGPathElement, d3.HierarchyLink<OrgChartNodeData>>('path.org-chart-link')
            .data(visibleLinks, d => (d.target.data as any).id);

        linkSelection.exit().remove();

        const linkEnter = linkSelection.enter().append('path')
            .attr('class', 'org-chart-link');

        linkSelection.merge(linkEnter as any)
            .attr('d', d => this.diagonal({ source: d.source, target: d.target }));


        // --- Extra Relationships ---
        // Just render all for now or filter? extra links are rare. let's filter.
        // Skipping extra links logic for brevity in virtual render unless requested, 
        // but let's keep it simple: just render visible ones.
        // (Implementation omitted for brevity to focus on core)
        // Re-adding simple extra link render:
        this.renderExtraLinks(visibleNodes);
    }

    // ... Copy over helper methods (renderExtraLinks, extraLinkPath, diagonal, drag handlers, public API) ...
    // Since I'm overwriting, I must include them.

    private renderExtraLinks(visibleNodes: d3.HierarchyPointNode<OrgChartNodeData>[]) {
        // Find extra links where both source and target are in cachedNodes (but we only render if source is visible?)
        // Let's rely on cachedNodes map
        const nodeMap = new Map(this.cachedNodes.map(n => [n.data.id, n]));
        const extraLinks: any[] = [];

        visibleNodes.forEach(n => {
            if (n.data.relatedIds && Array.isArray(n.data.relatedIds)) {
                n.data.relatedIds.forEach((targetId: string) => {
                    const target = nodeMap.get(targetId);
                    if (target) {
                        // Only add if source is visible (which 'n' is). 
                        // Target doesn't strictly need to be visible for the line to start.
                        extraLinks.push({ source: n, target: target });
                    }
                });
            }
        });

        const selection = this.linkGroup.selectAll<SVGPathElement, any>('path.org-chart-extra-link')
            .data(extraLinks); // No key?

        selection.enter().append('path')
            .attr('class', 'org-chart-extra-link')
            .attr('fill', 'none')
            .attr('stroke', '#999')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '5,5')
            .attr('d', d => this.extraLinkPath(d.source, d.target))
            .merge(selection)
            .attr('d', d => this.extraLinkPath(d.source, d.target));

        selection.exit().remove();
    }

    private extraLinkPath(s: { x: number, y: number }, t: { x: number, y: number }) {
        const sx = s.x;
        const sy = s.y + this.nodeHeight;
        const tx = t.x;
        const ty = t.y;
        const midY = (sy + ty) / 2;
        return `M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`;
    }

    private diagonal(d: { source: { x: number, y: number }, target: { x: number, y: number } }) {
        const s = d.source;
        const t = d.target;
        const sx = s.x;
        const sy = s.y + this.nodeHeight;
        const tx = t.x;
        const ty = t.y;
        const midY = (sy + ty) / 2;
        return `M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`;
    }

    // --- Drag & Drop ---
    private onDragStart(event: any, d: d3.HierarchyPointNode<OrgChartNodeData>) {
        if (!d.parent) return;
        const nodeElement = (event.sourceEvent.target as HTMLElement).closest('.org-chart-node');
        let initialContent = '';
        if (nodeElement) {
            d3.select(nodeElement).classed('dragging', true);
            const contentEl = nodeElement.querySelector('.org-chart-node-content');
            if (contentEl) initialContent = contentEl.innerHTML;
        }

        this.ghostNode = this.g.append('g')
            .attr('class', 'org-chart-ghost-node')
            .attr('transform', `translate(${d.x}, ${d.y})`)
            .attr('pointer-events', 'none')
            .raise();

        this.ghostNode.append('rect')
            .attr('width', this.nodeWidth)
            .attr('height', this.nodeHeight)
            .attr('x', -this.nodeWidth / 2)
            .attr('fill', '#ffffff')
            .attr('fill-opacity', 0.8)
            .attr('stroke', '#1890ff')
            .attr('stroke-dasharray', '4')
            .attr('rx', 4);

        if (initialContent) {
            this.ghostNode.append('foreignObject')
                .attr('width', this.nodeWidth)
                .attr('height', this.nodeHeight)
                .attr('x', -this.nodeWidth / 2)
                .attr('y', 0)
                .append('xhtml:div')
                .style('width', '100%')
                .style('height', '100%')
                .attr('class', 'org-chart-node-content')
                .html(initialContent);
        }
    }

    private onDrag(event: any, d: d3.HierarchyPointNode<OrgChartNodeData>) {
        if (!this.ghostNode) return;
        this.ghostNode.attr('transform', `translate(${event.x}, ${event.y})`);

        this.dropTarget = null;
        if (this.dropIndicator) {
            this.dropIndicator.remove();
            this.dropIndicator = null;
        }

        // Search cachedNodes for drop target (global search vs viewport search? Global is safer but slower)
        // With 100 nodes global is fine. With 1000 maybe optimize.
        const nodes = this.cachedNodes;
        let bestCandidate: d3.HierarchyPointNode<OrgChartNodeData> | null = null;
        let minDist = Infinity;

        for (const node of nodes) {
            if (node.data.id === d.data.id) continue;
            const nx = node.x;
            const ny = node.y;
            const nw = this.nodeWidth;
            const nh = this.nodeHeight;

            // Reparent
            if (event.x >= nx - nw / 2 && event.x <= nx + nw / 2 && event.y >= ny && event.y <= ny + nh) {
                if (node.ancestors().some(a => a.data.id === d.data.id)) continue;
                this.dropTarget = { type: 'reparent', targetId: node.data.id };
                this.dropIndicator = this.g.append('rect')
                    .attr('x', nx - nw / 2 - 5).attr('y', ny - 5)
                    .attr('width', nw + 10).attr('height', nh + 10)
                    .attr('fill', 'none').attr('stroke', '#1890ff').attr('stroke-width', 3).attr('rx', 6) as any;
                return;
            }

            // Reorder
            if (node.parent === d.parent) {
                const dx = Math.abs(node.x - event.x);
                const dy = Math.abs((node.y + nh / 2) - event.y);
                if (dy < nh / 2 && dx < minDist) {
                    minDist = dx;
                    bestCandidate = node;
                }
            }
        }

        if (bestCandidate && minDist < this.nodeWidth) {
            const cx = bestCandidate.x;
            const isBefore = event.x < cx;
            this.dropTarget = { type: 'reorder', targetId: bestCandidate.data.id, position: isBefore ? 'before' : 'after' };
            const ix = isBefore ? cx - this.nodeWidth / 2 - 15 : cx + this.nodeWidth / 2 + 15;
            const iy = bestCandidate.y;
            this.dropIndicator = this.g.append('line')
                .attr('x1', ix).attr('y1', iy).attr('x2', ix).attr('y2', iy + this.nodeHeight)
                .attr('stroke', '#1890ff').attr('stroke-width', 4) as any;
        }
    }

    private onDragEnd(event: any, d: d3.HierarchyPointNode<OrgChartNodeData>) {
        if (this.ghostNode) { this.ghostNode.remove(); this.ghostNode = null; }
        if (this.dropIndicator) { this.dropIndicator.remove(); this.dropIndicator = null; }

        const nodeElement = (event.sourceEvent.target as HTMLElement).closest('.org-chart-node');
        if (nodeElement) d3.select(nodeElement).classed('dragging', false);

        if (this.dropTarget) {
            this.applyDropChange(d.data.id, this.dropTarget);
        }
    }

    private applyDropChange(movedId: string, target: { type: 'reparent' | 'reorder', targetId: string, position?: 'before' | 'after' }) {
        const movedNodeIndex = this.rawData.findIndex(n => n.id === movedId);
        if (movedNodeIndex === -1) return;
        const movedNode = this.rawData[movedNodeIndex];
        let changed = false;

        if (target.type === 'reparent') {
            if (movedNode.parentId !== target.targetId) {
                movedNode.parentId = target.targetId;
                changed = true;
            }
        } else if (target.type === 'reorder') {
            // ... Logic same as before ...
            const targetIndex = this.rawData.findIndex(n => n.id === target.targetId);
            if (targetIndex > -1) {
                this.rawData.splice(movedNodeIndex, 1);
                let newTargetIndex = this.rawData.findIndex(n => n.id === target.targetId);
                if (target.position === 'after') newTargetIndex++;
                this.rawData.splice(newTargetIndex, 0, movedNode);
                changed = true;
            }
        }

        if (changed) {
            this.render(this.rawData);
            if (this.options.onDataChange) this.options.onDataChange(this.rawData);
        }
    }

    // --- Public API ---
    public setMode(mode: 'view' | 'edit') {
        this.mode = mode;
        this.container.dataset.mode = mode;
    }

    public fitToScreen() {
        if (!this.root) return;
        // Need to calculate bounds of ALL nodes, not just visible ones (g.node().getBBox might be partial)
        // Use cached layout data
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.cachedNodes.forEach(n => {
            if (n.x < minX) minX = n.x;
            if (n.x > maxX) maxX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.y > maxY) maxY = n.y;
        });

        // Add node dimensions
        minX -= this.nodeWidth / 2; maxX += this.nodeWidth / 2;
        maxY += this.nodeHeight;

        const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        const parent = this.container.getBoundingClientRect();

        // ... same scaling logic
        let scale = 0.9 / Math.max(bounds.width / parent.width, bounds.height / parent.height);
        if (scale > 1) scale = 1;

        const tx = parent.width / 2 - (bounds.x + bounds.width / 2) * scale;
        const ty = parent.height / 2 - (bounds.y + bounds.height / 2) * scale;

        this.svg.transition().duration(750)
            .call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }

    public resetView(animate: boolean = true) {
        if (!this.root) return;

        const parent = this.container.getBoundingClientRect();

        // Fix: Do NOT shrink to fit everything, as that negates virtual rendering benefits.
        // Instead, reset to a comfortable viewing scale (e.g., 1.0 or 0.8) and center the root.
        const scale = 1.0;

        // Center Root Node horizontally
        // root.x is relative to the group, so we shift group to center root
        // Note: this.root.x is computed by D3 tree layout, centered at 0 usually? No, D3 tree layout generates x values relative to parents.
        // But usually the library shifts it. Let's assume minX is ~0 for first node? 
        // D3's tree() layout centers parent relative to children.
        // Let's use the actual root coordinate.
        const rootNode = this.root;

        const tx = parent.width / 2 - rootNode.x * scale;
        const ty = 50 - rootNode.y * scale; // 50px top margin

        if (animate) {
            this.svg.transition().duration(750)
                .call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
                .on('end', () => this.renderViewport()); // Ensure render
        } else {
            // Set transform directly
            this.svg.call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

            // Important: Must update currentTransform manually if we don't wait for zoom event
            this.currentTransform = d3.zoomIdentity.translate(tx, ty).scale(scale);

            // Force render
            this.renderViewport();
        }
    }

    public centerNode(nodeId: string) {
        const node = this.findNode(nodeId);
        if (node) {
            this.setSelected(nodeId);
            this.expandStartFrom(node);
            this.updateLayout(this.root); // Recompute layout (expand path)

            const parent = this.container.getBoundingClientRect();
            // Get current scale to maintain it, or zoom to 1?
            // Usually zoom to 1 is better for focus.
            const k = 1;

            const tx = parent.width / 2 - node.x * k;
            const ty = parent.height / 2 - node.y * k;

            this.svg.transition().duration(750)
                .call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k))
                .on('end', () => this.renderViewport()); // Ensure render happens after transition
        }
    }

    // ... helper findNode, expandStartFrom, setSelected ...

    public setSelected(id: string | null) {
        this.selectedNodeId = id;
        this.nodeGroup.selectAll<SVGGElement, d3.HierarchyPointNode<OrgChartNodeData>>('g.org-chart-node')
            .classed('selected', d => d.data.id === this.selectedNodeId);
    }

    private findNode(id: string, node: d3.HierarchyPointNode<OrgChartNodeData> | null = this.root): d3.HierarchyPointNode<OrgChartNodeData> | null {
        // Search cachedNodes is faster since it includes all? No, cachedNodes are only visible/expanded ones.
        // Need to search hidden ones too to expand them.
        // But cachedNodes usually only contains result of treeLayout(root).
        // If nodes are hidden in _children, they are NOT in cachedNodes (which comes from descendants()).

        // So we must traverse the hierarchy recursively starting from root, checking _children too.
        if (!node) return null;
        if (node.data.id === id) return node;

        const childrenCode = (node.children || []).concat((node as any)._children || []);
        for (const child of childrenCode) {
            const found = this.findNode(id, child);
            if (found) return found;
        }
        return null;
    }

    private expandStartFrom(node: d3.HierarchyPointNode<OrgChartNodeData>) {
        let current = node;
        while (current.parent) {
            const parent = current.parent;
            if ((parent as any)._children) {
                if (!parent.children) parent.children = [];
                parent.children = (parent as any)._children;
                (parent as any)._children = undefined;
            }
            current = parent;
        }
    }
}
