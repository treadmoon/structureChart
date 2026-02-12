
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

        this.treeLayout = d3.tree<OrgChartNodeData>()
            .nodeSize([this.nodeWidth + (options.nodeSpacingX || 50), this.nodeHeight + (options.nodeSpacingY || 80)]);
    }

    private initDOM() {
        this.container.innerHTML = '';
        this.container.classList.add('org-chart-container');
        this.container.dataset.mode = this.mode;
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
                // Scroll/Zoom -> No Animation
                this.renderViewport(false);
            });

        this.svg.call(this.zoomBehavior).on("dblclick.zoom", null);
    }

    public render(data: OrgChartNodeData[]) {
        this.rawData = JSON.parse(JSON.stringify(data));

        try {
            const rootHierarchy = d3.stratify<OrgChartNodeData>()
                .id(d => d.id)
                .parentId(d => d.parentId)
                (this.rawData);

            this.root = rootHierarchy as d3.HierarchyPointNode<OrgChartNodeData>;

            if (!this.root.x) {
                (this.root as any).x0 = 0;
                (this.root as any).y0 = 0;
            }

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
                this.resetView(false);
                this.isFirstRender = false;
            }

        } catch (e) {
            console.error("Failed to stratify data", e);
        }
    }

    private updateLayout(source: any) {
        if (!this.root) return;

        const treeData = this.treeLayout(this.root);
        this.cachedNodes = treeData.descendants();
        this.cachedLinks = treeData.links();

        this.cachedNodes.forEach(d => {
            d.y = d.depth * (this.nodeHeight + (this.options.nodeSpacingY || 80));
        });

        // Layout Change -> Animation = True
        this.renderViewport(true, source);

        // Stash positions
        this.cachedNodes.forEach(d => {
            (d as any).x0 = d.x;
            (d as any).y0 = d.y;
        });
    }

    private renderViewport(animate: boolean = false, source?: any) {
        if (!this.root) return;
        source = source || this.root;

        // 1. Calculate Viewport
        const containerRect = this.container.getBoundingClientRect();
        const t = this.currentTransform;
        const buffer = 800; // Large buffer for structure updates
        const minX = (-t.x - buffer) / t.k;
        const maxX = (containerRect.width - t.x + buffer) / t.k;
        const minY = (-t.y - buffer) / t.k;
        const maxY = (containerRect.height - t.y + buffer) / t.k;

        // 2. Filter Nodes
        const visibleNodes = this.cachedNodes.filter(d => {
            const x = d.x;
            const y = d.y;
            return x >= minX - this.nodeWidth / 2 && x <= maxX + this.nodeWidth / 2 &&
                y >= minY && y <= maxY + this.nodeHeight;
        });

        const visibleLinks = this.cachedLinks.filter(l => {
            const sx = l.source.x, sy = l.source.y;
            const tx = l.target.x, ty = l.target.y;
            const lMinX = Math.min(sx, tx) - 50, lMaxX = Math.max(sx, tx) + 50;
            const lMinY = Math.min(sy, ty) - 50, lMaxY = Math.max(sy, ty) + 50;
            return !(lMaxX < minX || lMinX > maxX || lMaxY < minY || lMinY > maxY);
        });

        // --- Render Nodes ---
        const nodeSelection = this.nodeGroup.selectAll<SVGGElement, d3.HierarchyPointNode<OrgChartNodeData>>('g.org-chart-node')
            .data(visibleNodes, d => d.data.id);

        // EXIT
        const nodeExit = nodeSelection.exit();
        if (animate) {
            nodeExit.transition().duration(this.animationDuration)
                .attr('transform', _d => `translate(${source.x}, ${source.y})`)
                .attr('opacity', 0)
                .remove();
        } else {
            nodeExit.remove();
        }

        // ENTER
        const nodeEnter = nodeSelection.enter().append('g')
            .attr('class', 'org-chart-node')
            // If animating, enter from parent's OLD position (x0), otherwise target pos
            .attr('transform', d => animate ? `translate(${source.x0 || source.x}, ${source.y0 || source.y})` : `translate(${d.x}, ${d.y})`)
            .attr('opacity', animate ? 0 : 1)
            .on('click', (_event, d) => {
                if (this.mode === 'view') {
                    if (this.selectedNodeId === d.data.id) this.setSelected(null);
                    else {
                        this.setSelected(d.data.id);
                        if (this.options.onNodeClick) this.options.onNodeClick(d.data.id);
                    }
                }
            });

        const fo = nodeEnter.append('foreignObject')
            .attr('width', this.nodeWidth)
            .attr('height', this.nodeHeight)
            .attr('x', -this.nodeWidth / 2)
            .attr('y', 0);

        fo.append('xhtml:div')
            .style('width', '100%').style('height', '100%').attr('class', 'org-chart-node-content');

        const collapseGroup = nodeEnter.append('g')
            .attr('class', 'org-chart-collapse-group')
            .attr('transform', `translate(0, ${this.nodeHeight + 10})`)
            .attr('cursor', 'pointer');
        collapseGroup.append('circle').attr('class', 'org-chart-collapse-btn').attr('r', 8);
        collapseGroup.append('text').attr('class', 'org-chart-collapse-symbol').attr('text-anchor', 'middle').attr('dy', 4).style('font-size', '12px');

        // UPDATE
        const nodeUpdate = nodeEnter.merge(nodeSelection as any);

        // Transition or Instant
        if (animate) {
            nodeUpdate.transition().duration(this.animationDuration)
                .attr('transform', d => `translate(${d.x}, ${d.y})`)
                .attr('opacity', 1);
        } else {
            nodeUpdate
                .attr('transform', d => `translate(${d.x}, ${d.y})`)
                .attr('opacity', 1);
        }

        // Content & Events Update
        nodeUpdate.select('.org-chart-collapse-group').on('click', (event, d) => {
            event.stopPropagation();
            if (d.children) {
                (d as any)._children = d.children;
                d.children = undefined;
            } else {
                d.children = (d as any)._children;
                (d as any)._children = undefined;
            }
            this.updateLayout(d);
        });

        nodeUpdate.each((d, i, n) => {
            const el = d3.select(n[i]).select('.org-chart-node-content').node() as HTMLElement;
            if (el) {
                el.innerHTML = '';
                const content = this.options.renderContent(d.data);
                if (typeof content === 'string') el.innerHTML = content;
                else el.appendChild(content);
            }
        });

        nodeUpdate.classed('selected', d => d.data.id === this.selectedNodeId);
        nodeUpdate.select('.org-chart-collapse-group').attr('display', (d) => (d.children || (d as any)._children) ? 'inline' : 'none');
        nodeUpdate.select('.org-chart-collapse-symbol').text((d) => (d as any)._children ? '+' : '-');

        // Drag
        const drag = d3.drag<SVGGElement, d3.HierarchyPointNode<OrgChartNodeData>>().filter(() => this.mode === 'edit')
            .on('start', this.onDragStart.bind(this)).on('drag', this.onDrag.bind(this)).on('end', this.onDragEnd.bind(this));
        nodeUpdate.call(drag as any);

        // --- Render Links ---
        const linkSelection = this.linkGroup.selectAll<SVGPathElement, d3.HierarchyLink<OrgChartNodeData>>('path.org-chart-link')
            .data(visibleLinks, d => (d.target.data as any).id);

        // EXIT
        if (animate) {
            linkSelection.exit().transition().duration(this.animationDuration)
                .attr('d', _d => {
                    const o = { x: source.x, y: source.y };
                    return this.diagonal({ source: o, target: o });
                })
                .remove();
        } else {
            linkSelection.exit().remove();
        }

        // ENTER
        const linkEnter = linkSelection.enter().append('path')
            .attr('class', 'org-chart-link')
            .attr('d', _d => {
                const o = animate ? { x: source.x0 || source.x, y: source.y0 || source.y } : { x: _d.source.x, y: _d.source.y }; // Actually link needs correct geometry
                // Simplification for enter animation: from source pos
                const s = animate ? { x: source.x0 || source.x, y: source.y0 || source.y } : { x: _d.source.x, y: _d.source.y };
                return this.diagonal({ source: s, target: s });
            });

        // UPDATE
        if (animate) {
            linkSelection.merge(linkEnter as any).transition().duration(this.animationDuration)
                .attr('d', d => this.diagonal({ source: d.source, target: d.target }));
        } else {
            linkSelection.merge(linkEnter as any)
                .attr('d', d => this.diagonal({ source: d.source, target: d.target }));
        }

        this.renderExtraLinks(visibleNodes, animate);
    }

    // ... helpers ...

    private renderExtraLinks(visibleNodes: d3.HierarchyPointNode<OrgChartNodeData>[], animate: boolean) {
        const nodeMap = new Map(this.cachedNodes.map(n => [n.data.id, n]));
        const extraLinks: any[] = [];
        visibleNodes.forEach(n => {
            if (n.data.relatedIds && Array.isArray(n.data.relatedIds)) {
                n.data.relatedIds.forEach((targetId: string) => {
                    const target = nodeMap.get(targetId);
                    if (target) extraLinks.push({ source: n, target: target });
                });
            }
        });
        const selection = this.linkGroup.selectAll<SVGPathElement, any>('path.org-chart-extra-link').data(extraLinks);

        if (animate) selection.exit().remove(); else selection.exit().remove(); // Simple remove for extras

        const enter = selection.enter().append('path')
            .attr('class', 'org-chart-extra-link')
            .attr('fill', 'none').attr('stroke', '#999').attr('stroke-width', 1).attr('stroke-dasharray', '5,5')
            .attr('d', d => this.extraLinkPath(d.source, d.target));

        if (animate) {
            selection.merge(enter).transition().duration(this.animationDuration)
                .attr('d', d => this.extraLinkPath(d.source, d.target));
        } else {
            selection.merge(enter).attr('d', d => this.extraLinkPath(d.source, d.target));
        }
    }

    private extraLinkPath(s: { x: number, y: number }, t: { x: number, y: number }) {
        const sx = s.x; const sy = s.y + this.nodeHeight; const tx = t.x; const ty = t.y; const midY = (sy + ty) / 2;
        return `M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`;
    }

    private diagonal(d: { source: { x: number, y: number }, target: { x: number, y: number } }) {
        const s = d.source; const t = d.target;
        const sx = s.x; const sy = s.y + this.nodeHeight; const tx = t.x; const ty = t.y; const midY = (sy + ty) / 2;
        return `M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`;
    }

    private onDragStart(event: any, d: d3.HierarchyPointNode<OrgChartNodeData>) {
        if (!d.parent) return;
        const nodeElement = (event.sourceEvent.target as HTMLElement).closest('.org-chart-node');
        let initialContent = '';
        if (nodeElement) {
            d3.select(nodeElement).classed('dragging', true);
            const contentEl = nodeElement.querySelector('.org-chart-node-content');
            if (contentEl) initialContent = contentEl.innerHTML;
        }
        this.ghostNode = this.g.append('g').attr('class', 'org-chart-ghost-node').attr('transform', `translate(${d.x}, ${d.y})`).attr('pointer-events', 'none').raise();
        this.ghostNode.append('rect').attr('width', this.nodeWidth).attr('height', this.nodeHeight).attr('x', -this.nodeWidth / 2).attr('fill', '#ffffff').attr('fill-opacity', 0.8).attr('stroke', '#1890ff').attr('stroke-dasharray', '4').attr('rx', 4);
        if (initialContent) {
            this.ghostNode.append('foreignObject').attr('width', this.nodeWidth).attr('height', this.nodeHeight).attr('x', -this.nodeWidth / 2).attr('y', 0).append('xhtml:div').style('width', '100%').style('height', '100%').attr('class', 'org-chart-node-content').html(initialContent);
        }
    }

    private onDrag(event: any, d: d3.HierarchyPointNode<OrgChartNodeData>) {
        if (!this.ghostNode) return;
        this.ghostNode.attr('transform', `translate(${event.x}, ${event.y})`);
        this.dropTarget = null;
        if (this.dropIndicator) { this.dropIndicator.remove(); this.dropIndicator = null; }
        const nodes = this.cachedNodes;
        let bestCandidate: d3.HierarchyPointNode<OrgChartNodeData> | null = null;
        let minDist = Infinity;
        for (const node of nodes) {
            if (node.data.id === d.data.id) continue;
            const nx = node.x; const ny = node.y; const nw = this.nodeWidth; const nh = this.nodeHeight;
            if (event.x >= nx - nw / 2 && event.x <= nx + nw / 2 && event.y >= ny && event.y <= ny + nh) {
                if (node.ancestors().some(a => a.data.id === d.data.id)) continue;
                this.dropTarget = { type: 'reparent', targetId: node.data.id };
                this.dropIndicator = this.g.append('rect').attr('x', nx - nw / 2 - 5).attr('y', ny - 5).attr('width', nw + 10).attr('height', nh + 10).attr('fill', 'none').attr('stroke', '#1890ff').attr('stroke-width', 3).attr('rx', 6) as any;
                return;
            }
            if (node.parent === d.parent) {
                const dx = Math.abs(node.x - event.x); const dy = Math.abs((node.y + nh / 2) - event.y);
                if (dy < nh / 2 && dx < minDist) { minDist = dx; bestCandidate = node; }
            }
        }
        if (bestCandidate && minDist < this.nodeWidth) {
            const cx = bestCandidate.x; const isBefore = event.x < cx;
            this.dropTarget = { type: 'reorder', targetId: bestCandidate.data.id, position: isBefore ? 'before' : 'after' };
            const ix = isBefore ? cx - this.nodeWidth / 2 - 15 : cx + this.nodeWidth / 2 + 15; const iy = bestCandidate.y;
            this.dropIndicator = this.g.append('line').attr('x1', ix).attr('y1', iy).attr('x2', ix).attr('y2', iy + this.nodeHeight).attr('stroke', '#1890ff').attr('stroke-width', 4) as any;
        }
    }

    private onDragEnd(event: any, d: d3.HierarchyPointNode<OrgChartNodeData>) {
        if (this.ghostNode) { this.ghostNode.remove(); this.ghostNode = null; }
        if (this.dropIndicator) { this.dropIndicator.remove(); this.dropIndicator = null; }
        const nodeElement = (event.sourceEvent.target as HTMLElement).closest('.org-chart-node');
        if (nodeElement) d3.select(nodeElement).classed('dragging', false);
        if (this.dropTarget) { this.applyDropChange(d.data.id, this.dropTarget); }
    }

    private applyDropChange(movedId: string, target: { type: 'reparent' | 'reorder', targetId: string, position?: 'before' | 'after' }) {
        const movedNodeIndex = this.rawData.findIndex(n => n.id === movedId);
        if (movedNodeIndex === -1) return;
        const movedNode = this.rawData[movedNodeIndex];
        let changed = false;
        if (target.type === 'reparent') {
            if (movedNode.parentId !== target.targetId) { movedNode.parentId = target.targetId; changed = true; }
        } else if (target.type === 'reorder') {
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

    public setMode(mode: 'view' | 'edit') { this.mode = mode; this.container.dataset.mode = mode; }

    public fitToScreen() {
        if (!this.root) return;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.cachedNodes.forEach(n => { if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x; if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y; });
        minX -= this.nodeWidth / 2; maxX += this.nodeWidth / 2; maxY += this.nodeHeight;
        const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        const parent = this.container.getBoundingClientRect();
        let scale = 0.9 / Math.max(bounds.width / parent.width, bounds.height / parent.height);
        if (scale > 1) scale = 1;
        const tx = parent.width / 2 - (bounds.x + bounds.width / 2) * scale;
        const ty = parent.height / 2 - (bounds.y + bounds.height / 2) * scale;
        this.svg.transition().duration(750).call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    }

    public resetView(animate: boolean = true) {
        if (!this.root) return;
        const parent = this.container.getBoundingClientRect();
        const scale = 1.0;
        const rootNode = this.root;
        const tx = parent.width / 2 - rootNode.x * scale;
        const ty = 50 - rootNode.y * scale;
        if (animate) {
            this.svg.transition().duration(750)
                .call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
                .on('end', () => this.renderViewport(false));
        } else {
            this.svg.call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
            this.currentTransform = d3.zoomIdentity.translate(tx, ty).scale(scale);
            this.renderViewport(false);
        }
    }

    public centerNode(nodeId: string) {
        const node = this.findNode(nodeId);
        if (node) {
            this.setSelected(nodeId);
            this.expandStartFrom(node);
            this.updateLayout(this.root);
            const parent = this.container.getBoundingClientRect();
            const k = 1;
            const tx = parent.width / 2 - node.x * k;
            const ty = parent.height / 2 - node.y * k;
            this.svg.transition().duration(750)
                .call(this.zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(k))
                .on('end', () => this.renderViewport(false));
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
        for (const child of childrenCode) { const found = this.findNode(id, child); if (found) return found; }
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
