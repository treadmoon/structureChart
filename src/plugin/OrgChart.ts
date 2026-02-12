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

    // State
    private mode: 'view' | 'edit' = 'view';
    private zoomBehavior!: d3.ZoomBehavior<SVGSVGElement, unknown>;
    private selectedNodeId: string | null = null;
    private isFirstRender = true;

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
                this.g.attr('transform', event.transform);
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

            this.update(this.root);

            if (this.isFirstRender) {
                this.resetView(false); // No animation for first render
                this.isFirstRender = false;
            }

        } catch (e) {
            console.error("Failed to stratify data", e);
        }
    }

    private update(source: any) {
        if (!this.root) return;

        // Compute layout
        const treeData = this.treeLayout(this.root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // Normalize for fixed-depth
        nodes.forEach(d => {
            d.y = d.depth * (this.nodeHeight + (this.options.nodeSpacingY || 80));
        });

        // --- Nodes ---
        const nodeSelection = this.nodeGroup.selectAll<SVGGElement, d3.HierarchyPointNode<OrgChartNodeData>>('g.org-chart-node')
            .data(nodes, d => d.data.id);

        // Enter
        const nodeEnter = nodeSelection.enter().append('g')
            .attr('class', 'org-chart-node')
            .attr('transform', _d => `translate(${source.x0 || source.x}, ${source.y0 || source.y})`)
            .attr('opacity', 0)
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

        // Foreign Object for Content
        const fo = nodeEnter.append('foreignObject')
            .attr('width', this.nodeWidth)
            .attr('height', this.nodeHeight)
            .attr('x', -this.nodeWidth / 2)
            .attr('y', 0); // Top centered at x

        // Append content container
        fo.append('xhtml:div')
            .style('width', '100%')
            .style('height', '100%')
            .attr('class', 'org-chart-node-content');

        // Collapse/Expand Button
        const collapseGroup = nodeEnter.append('g')
            .attr('class', 'org-chart-collapse-group')
            .attr('transform', `translate(0, ${this.nodeHeight + 10})`)
            .attr('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation(); // prevent node click
                if (d.children) {
                    (d as any)._children = d.children;
                    d.children = undefined;
                } else {
                    d.children = (d as any)._children;
                    (d as any)._children = undefined;
                }
                this.update(d);
            });

        collapseGroup.append('circle')
            .attr('class', 'org-chart-collapse-btn')
            .attr('r', 8);

        collapseGroup.append('text')
            .attr('class', 'org-chart-collapse-symbol')
            .attr('text-anchor', 'middle')
            .attr('dy', 4)
            .style('font-size', '12px');

        // Update Content
        const nodeUpdate = nodeEnter.merge(nodeSelection as any);

        nodeUpdate.each((d, i, n) => {
            const el = d3.select(n[i]).select('.org-chart-node-content').node() as HTMLElement;
            if (el) {
                // Only update content if it's empty to allow updates? Or always update?
                // For now, let's keep it simple: always re-render might be expensive but safe.
                // Actually the previous code was doing it on merge, effectively re-rendering on every update.
                // Let's preserve that.
                el.innerHTML = '';
                const content = this.options.renderContent(d.data);
                if (typeof content === 'string') {
                    el.innerHTML = content;
                } else {
                    el.appendChild(content);
                }
            }
        });

        // Update Collapse Button Visibility & State
        nodeUpdate.select('.org-chart-collapse-group')
            .attr('display', (d) => (d.children || (d as any)._children) ? 'inline' : 'none');

        nodeUpdate.select('.org-chart-collapse-symbol')
            .text((d) => (d as any)._children ? '+' : '-');

        // Add Drag Behavior (instantiated but conditionally active)
        const drag = d3.drag<SVGGElement, d3.HierarchyPointNode<OrgChartNodeData>>()
            .filter(() => this.mode === 'edit')
            .on('start', this.onDragStart.bind(this))
            .on('drag', this.onDrag.bind(this))
            .on('end', this.onDragEnd.bind(this));

        nodeEnter.call(drag as any);

        // Update positions
        nodeUpdate
            .classed('selected', d => d.data.id === this.selectedNodeId)
            .transition().duration(this.animationDuration)
            .attr('transform', d => `translate(${d.x}, ${d.y})`)
            .attr('opacity', 1);

        // Exit
        nodeSelection.exit().transition().duration(this.animationDuration)
            .attr('transform', _d => `translate(${source.x}, ${source.y})`)
            .attr('opacity', 0)
            .remove();

        // --- Links ---
        const linkSelection = this.linkGroup.selectAll<SVGPathElement, d3.HierarchyLink<OrgChartNodeData>>('path.org-chart-link')
            .data(links, d => (d.target.data as any).id);

        // Enter
        const linkEnter = linkSelection.enter().append('path')
            .attr('class', 'org-chart-link')
            .attr('d', _d => {
                const o = { x: source.x0 || source.x, y: source.y0 || source.y };
                return this.diagonal({ source: o, target: o });
            });

        // Update
        linkSelection.merge(linkEnter as any).transition().duration(this.animationDuration)
            .attr('d', d => this.diagonal({ source: d.source as any, target: d.target as any }));

        // Exit
        linkSelection.exit().transition().duration(this.animationDuration)
            .attr('d', _d => {
                const o = { x: source.x, y: source.y };
                return this.diagonal({ source: o, target: o });
            })
            .remove();

        // --- Extra Relationships (Dotted Lines) ---
        this.renderExtraLinks(nodes);

        // Stash the old positions for transition
        nodes.forEach(d => {
            (d as any).x0 = d.x;
            (d as any).y0 = d.y;
        });
    }

    private renderExtraLinks(nodes: d3.HierarchyPointNode<OrgChartNodeData>[]) {
        const extraLinks: { source: d3.HierarchyPointNode<OrgChartNodeData>, target: d3.HierarchyPointNode<OrgChartNodeData> }[] = [];
        const nodeMap = new Map(nodes.map(n => [n.data.id, n]));

        nodes.forEach(n => {
            if (n.data.relatedIds && Array.isArray(n.data.relatedIds)) {
                n.data.relatedIds.forEach((targetId: string) => {
                    const target = nodeMap.get(targetId);
                    if (target) {
                        extraLinks.push({ source: n, target: target });
                    }
                });
            }
        });

        const selection = this.linkGroup.selectAll<SVGPathElement, any>('path.org-chart-extra-link')
            .data(extraLinks);

        selection.enter().append('path')
            .attr('class', 'org-chart-extra-link')
            .attr('fill', 'none')
            .attr('stroke', '#999')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '5,5')
            .attr('d', d => this.extraLinkPath(d.source, d.target))
            .merge(selection) // Update existing
            .transition().duration(this.animationDuration)
            .attr('d', d => this.extraLinkPath(d.source, d.target));

        selection.exit().remove();
    }

    private extraLinkPath(s: { x: number, y: number }, t: { x: number, y: number }) {
        const sx = s.x;
        const sy = s.y + this.nodeHeight;
        const tx = t.x;
        const ty = t.y;

        const midY = (sy + ty) / 2;

        return `M ${sx} ${sy}
                L ${sx} ${midY}
                L ${tx} ${midY}
                L ${tx} ${ty}`;
    }

    private diagonal(d: { source: { x: number, y: number }, target: { x: number, y: number } }) {
        const s = d.source;
        const t = d.target;

        const sx = s.x;
        const sy = s.y + this.nodeHeight;
        const tx = t.x;
        const ty = t.y;

        const midY = (sy + ty) / 2;

        return `M ${sx} ${sy}
                L ${sx} ${midY}
                L ${tx} ${midY}
                L ${tx} ${ty}`;
    }

    // --- Drag & Drop ---

    private onDragStart(event: any, d: d3.HierarchyPointNode<OrgChartNodeData>) {
        if (!d.parent) return; // Prevent dragging root

        const nodeElement = (event.sourceEvent.target as HTMLElement).closest('.org-chart-node');
        let initialContent = '';
        if (nodeElement) {
            d3.select(nodeElement).classed('dragging', true);
            const contentEl = nodeElement.querySelector('.org-chart-node-content');
            if (contentEl) initialContent = contentEl.innerHTML;
        }

        // Create ghost
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

        // Update drop target
        this.dropTarget = null;
        if (this.dropIndicator) {
            this.dropIndicator.remove();
            this.dropIndicator = null;
        }

        const nodes = this.root!.descendants();
        let bestCandidate: d3.HierarchyPointNode<OrgChartNodeData> | null = null;
        let minDist = Infinity;

        for (const node of nodes) {
            if (node.data.id === d.data.id) continue;

            // Layout coords
            const nx = node.x;
            const ny = node.y;
            const nw = this.nodeWidth;
            const nh = this.nodeHeight;

            // Check overlap for Reparent
            if (event.x >= nx - nw / 2 && event.x <= nx + nw / 2 &&
                event.y >= ny && event.y <= ny + nh) {

                if (node.ancestors().some(a => a.data.id === d.data.id)) continue; // cyclical check

                this.dropTarget = { type: 'reparent', targetId: node.data.id };

                this.dropIndicator = this.g.append('rect')
                    .attr('x', nx - nw / 2 - 5)
                    .attr('y', ny - 5)
                    .attr('width', nw + 10)
                    .attr('height', nh + 10)
                    .attr('fill', 'none')
                    .attr('stroke', '#1890ff')
                    .attr('stroke-width', 3)
                    .attr('rx', 6) as unknown as d3.Selection<SVGGraphicsElement, unknown, null, undefined>;
                return;
            }

            // Check for sibling reorder
            if (node.parent === d.parent) {
                const dx = Math.abs(node.x - event.x);
                const dy = Math.abs((node.y + nh / 2) - event.y);

                if (dy < nh / 2 && dx < minDist) {
                    minDist = dx;
                    bestCandidate = node;
                }
            }
        }

        // Reorder indicator
        if (bestCandidate && minDist < this.nodeWidth) {
            const cx = bestCandidate.x;
            const isBefore = event.x < cx;

            this.dropTarget = {
                type: 'reorder',
                targetId: bestCandidate.data.id,
                position: isBefore ? 'before' : 'after'
            };

            const ix = isBefore ? cx - this.nodeWidth / 2 - 15 : cx + this.nodeWidth / 2 + 15;
            const iy = bestCandidate.y;

            this.dropIndicator = this.g.append('line')
                .attr('x1', ix).attr('y1', iy)
                .attr('x2', ix).attr('y2', iy + this.nodeHeight)
                .attr('stroke', '#1890ff')
                .attr('stroke-width', 4) as unknown as d3.Selection<SVGGraphicsElement, unknown, null, undefined>;
        }
    }

    private onDragEnd(event: any, d: d3.HierarchyPointNode<OrgChartNodeData>) {
        if (this.ghostNode) {
            this.ghostNode.remove();
            this.ghostNode = null;
        }
        if (this.dropIndicator) {
            this.dropIndicator.remove();
            this.dropIndicator = null;
        }

        const nodeElement = (event.sourceEvent.target as HTMLElement).closest('.org-chart-node');
        if (nodeElement) {
            d3.select(nodeElement).classed('dragging', false);
        }

        if (this.dropTarget) {
            this.applyDropChange(d.data.id, this.dropTarget);
        }
    }

    private applyDropChange(movedId: string, target: { type: 'reparent' | 'reorder', targetId: string, position?: 'before' | 'after' }) {
        console.log('Apply Change:', movedId, target);

        const movedNodeIndex = this.rawData.findIndex(n => n.id === movedId);
        if (movedNodeIndex === -1) {
            console.warn('Moved node not found in rawData');
            return;
        }
        const movedNode = this.rawData[movedNodeIndex];

        let changed = false;

        if (target.type === 'reparent') {
            if (movedNode.parentId !== target.targetId) {
                movedNode.parentId = target.targetId;
                changed = true;
            }
        } else if (target.type === 'reorder') {
            const targetIndex = this.rawData.findIndex(n => n.id === target.targetId);
            if (targetIndex > -1) {
                // Remove old
                this.rawData.splice(movedNodeIndex, 1);

                // Find new index
                let newTargetIndex = this.rawData.findIndex(n => n.id === target.targetId);
                if (target.position === 'after') newTargetIndex++;

                this.rawData.splice(newTargetIndex, 0, movedNode);
                changed = true;
            }
        }

        if (changed) {
            this.render(this.rawData);
            if (this.options.onDataChange) {
                this.options.onDataChange(this.rawData);
            }
        }
    }

    // --- Public API ---

    public setMode(mode: 'view' | 'edit') {
        this.mode = mode;
        this.container.dataset.mode = mode;
    }

    public fitToScreen() {
        if (!this.root) return;
        const bounds = this.g.node()?.getBBox();
        if (!bounds) return;

        const parent = this.container.getBoundingClientRect();
        const width = parent.width;
        const height = parent.height;

        let scale = 0.9 / Math.max(bounds.width / width, bounds.height / height);
        if (scale > 1) scale = 1;

        const tx = width / 2 - (bounds.x + bounds.width / 2) * scale;
        const ty = height / 2 - (bounds.y + bounds.height / 2) * scale;

        this.svg.transition().duration(750)
            .call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }

    public resetView(animate: boolean = true) {
        if (!this.root) return;
        const bounds = this.g.node()?.getBBox();
        if (!bounds) return;

        const parent = this.container.getBoundingClientRect();
        const width = parent.width;

        // Default scale 1, but fit width if content is wider than screen
        let scale = 1;
        if (bounds.width > width * 0.9) {
            scale = (width * 0.9) / bounds.width;
        }

        // Center Root Node horizontally
        const rootX = (this.root.x || 0); // Root node X relative to G
        const tx = width / 2 - rootX * scale;

        // Top margin 50px - RootY * scale
        const rootY = (this.root.y || 0);
        const ty = 50 - rootY * scale;

        if (animate) {
            this.svg.transition().duration(750)
                .call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        } else {
            this.svg.call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        }
    }

    public centerNode(nodeId: string) {
        const node = this.findNode(nodeId);
        if (node) {
            this.setSelected(nodeId);
            this.expandStartFrom(node);
            this.update(this.root);

            const parent = this.container.getBoundingClientRect();
            const t = d3.zoomTransform(this.svg.node()!);
            const k = t.k;

            const tx = parent.width / 2 - node.x * k;
            const ty = parent.height / 2 - node.y * k;

            this.svg.transition().duration(750)
                .call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
        } else {
            console.warn(`Node ${nodeId} not found`);
        }
    }

    public setSelected(id: string | null) {
        this.selectedNodeId = id;
        this.nodeGroup.selectAll<SVGGElement, d3.HierarchyPointNode<OrgChartNodeData>>('g.org-chart-node')
            .classed('selected', d => d.data.id === this.selectedNodeId);
    }

    private findNode(id: string, node: d3.HierarchyPointNode<OrgChartNodeData> | null = this.root): d3.HierarchyPointNode<OrgChartNodeData> | null {
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
                // If parent is collapsed, expand it
                if (!parent.children) parent.children = [];

                // We need to move _children back to children
                parent.children = (parent as any)._children;
                (parent as any)._children = undefined;
            }
            current = parent;
        }
    }
}
