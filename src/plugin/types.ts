export interface OrgChartNodeData {
    id: string;
    parentId: string | null;
    [key: string]: any; // Allow arbitrary business logic
}

export interface OrgChartRenderState {
    expanded: boolean;
    selected: boolean;
    hidden: boolean;
}

export interface HierarchyNode<T> extends d3.HierarchyNode<T> {
    x: number;
    y: number;
    data: T & OrgChartRenderState;
    _children?: HierarchyNode<T>[]; // For collapsing
}

export interface OrgChartOptions {
    /**
     * Callback to render the content within the node's foreignObject.
     * @param data The user data for the node.
     * @returns HTML string or HTMLElement.
     */
    renderContent: (data: OrgChartNodeData) => string | HTMLElement;

    /**
     * Width of the node card in pixels.
     * @default 200
     */
    nodeWidth?: number;

    /**
     * Height of the node card in pixels.
     * @default 100
     */
    nodeHeight?: number;

    /**
     * Horizontal spacing between nodes.
     * @default 50
     */
    nodeSpacingX?: number;

    /**
     * Vertical spacing between layers.
     * @default 100
     */
    nodeSpacingY?: number;

    /**
     * Callback when a node is clicked.
     */
    onNodeClick?: (nodeId: string) => void;

    /**
     * Callback when a node is dropped onto another (in Edit Mode).
     */
    onNodeDrop?: (sourceId: string, targetId: string) => void;

    /**
     * Callback when structure changes (reorder/reparent)
     */
    onDataChange?: (data: OrgChartNodeData[]) => void;

    /**
     * The depth to expand to on initial load.
     * Use 0 for root only, 1 for root + immediate children, etc.
     * Default is Infinity (expand all).
     */
    defaultExpandDepth?: number;
}
