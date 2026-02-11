import type { OrgChartNodeData } from './types';

// Template 1: Group Card (Dark Theme, Corporate Level)
export function renderGroupCard(d: OrgChartNodeData): string {
    return `
        <div class="org-card-group">
            <div class="org-card-group-header">
                <span class="org-card-group-icon">🏢</span>
                <span class="org-card-group-title">GROUP</span>
                <div class="org-card-menu-trigger" onclick="window.toggleNodeMenu(event, '${d.id}')">⋮</div>
            </div>
            <div class="org-card-group-body">
                <div class="org-card-name">${d.name}</div>
                <div class="org-card-title">${d['title'] || 'Group Executive'}</div>
            </div>
            <div class="org-card-group-footer">
                <span class="org-card-bade">HQ</span>
                <span class="org-card-stat">Subs: ${(d as any)._childrenCount || 0}</span>
            </div>
        </div>
    `;
}

// Template 2: Company Card (Formal, with Logo Placeholder)
export function renderCompanyCard(d: OrgChartNodeData): string {
    return `
        <div class="org-card-company">
            <div class="org-card-company-top">
                <div class="org-card-company-logo">C</div>
                <div class="org-card-menu-trigger" onclick="window.toggleNodeMenu(event, '${d.id}')">⋮</div>
            </div>
            <div class="org-card-company-info">
                <div class="org-card-name">${d.name}</div>
                <div class="org-card-title">${d['title'] || 'Manager'}</div>
            </div>
            <div class="org-card-company-status">
                Active Entity
            </div>
        </div>
    `;
}

// Template 3: Department Card (Clean, Modern, Default)
export function renderDepartmentCard(d: OrgChartNodeData): string {
    return `
        <div class="org-card-dept">
            <div class="org-card-dept-accent"></div>
            <div class="org-card-dept-body">
                 <div class="org-card-menu-trigger abs-right" onclick="window.toggleNodeMenu(event, '${d.id}')">⋮</div>
                <div class="org-card-name">${d.name}</div>
                <div class="org-card-title">${d['title'] || 'Staff'}</div>
                <div class="org-card-dept-meta">
                   <span>ID: ${d.id}</span>
                </div>
            </div>
        </div>
    `;
}

// Template 4: Center Card (Smart Switching)
export function renderCenterCard(d: OrgChartNodeData): string {
    const type = (d as any)._centerType || 'admin'; // default to admin if missing

    // Map type to CSS class and icon
    const config: any = {
        'ceo': { cls: 'org-card-ceo', icon: '👑', label: 'CEO OFFICE' },
        'rnd': { cls: 'org-card-rnd', icon: '💻', label: 'R&D CENTER' },
        'admin': { cls: 'org-card-admin', icon: '🛡️', label: 'ADMIN CENTER' },
        'sales': { cls: 'org-card-sales', icon: '🚀', label: 'SALES CENTER' },
        'product': { cls: 'org-card-product', icon: '💡', label: 'PRODUCT CENTER' }
    };

    const cfg = config[type] || config['admin'];

    return `
        <div class="org-card-center ${cfg.cls}">
            <div class="org-card-center-header">
                <div>
                    <span class="org-card-center-icon">${cfg.icon}</span>
                    <span>${cfg.label}</span>
                </div>
                 <div class="org-card-menu-trigger" onclick="window.toggleNodeMenu(event, '${d.id}')">⋮</div>
            </div>
            <div class="org-card-center-body">
                <div class="org-card-center-name">${d.name.split(' ')[0]}</div> 
                <div class="org-card-center-role">${d['title']}</div>
            </div>
        </div>
    `;
}
