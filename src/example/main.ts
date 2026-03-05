import './style.css'
import { OrgChart } from '../plugin/OrgChart';
import type { OrgChartNodeData } from '../plugin/types';
import { renderDepartmentCard, renderCompanyCard, renderGroupCard, renderCenterCard } from '../plugin/templates';



// Simple Toast Notification
function showToast(message: string, type: 'success' | 'error' | 'warning' = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Simple Confirm Dialog
function showConfirm(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    let overlay = document.getElementById('confirm-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <h3 class="confirm-title"></h3>
          <div class="confirm-message"></div>
          <div class="confirm-actions">
            <button class="btn-cancel">Cancel</button>
            <button class="btn-confirm">Confirm</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    overlay.querySelector('.confirm-title')!.textContent = title;
    overlay.querySelector('.confirm-message')!.textContent = message;

    const btnCancel = overlay.querySelector('.btn-cancel') as HTMLButtonElement;
    const btnConfirm = overlay.querySelector('.btn-confirm') as HTMLButtonElement;

    const cleanup = () => {
      overlay!.classList.remove('active');
      btnCancel.onclick = null;
      btnConfirm.onclick = null;
    };

    btnCancel.onclick = () => { cleanup(); resolve(false); };
    btnConfirm.onclick = () => { cleanup(); resolve(true); };

    // trigger reflow
    void overlay.offsetWidth;
    overlay.classList.add('active');
  });
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="sidebar">
    <div id="sidebar-content-wrapper">
      <div class="sidebar-header">
        <h2>StructureChart</h2>
        <button id="btn-toggle-sidebar" class="toggle-btn" title="Collapse Sidebar">◀</button>
      </div>
      
      <div style="padding: 0 20px 20px 20px; display: flex; flex-direction: column; gap: 20px;">
        
        <div class="control-group">
          <label style="font-size: 13px; color: #64748b; font-weight: 500;">Search</label>
          <div class="search-container">
            <div class="search-input-wrapper">
              <input type="text" id="inp-search" placeholder="Search name, title, or ID..." autocomplete="off" />
              <button id="btn-search">Search</button>
            </div>
            <div id="search-results"></div>
          </div>
        </div>
        
        <div class="control-group">
          <label style="font-size: 13px; color: #64748b; font-weight: 500;">View & Mode</label>
          <div class="control-row">
            <button id="btn-fit" class="control-btn">Fit Screen</button>
            <button id="btn-mode" class="control-btn">Mode: View</button>
          </div>
        </div>
        
        <div class="control-group">
          <label style="font-size: 13px; color: #64748b; font-weight: 500;">Template</label>
          <select id="sel-template" class="control-select">
              <option value="center" selected>Centers</option>
              <option value="dept">Department</option>
              <option value="company">Company</option>
              <option value="group">Group</option>
          </select>
        </div>
        
      </div>
    </div>
  </div>
  <button id="float-toggle-btn" class="toggle-btn" title="Expand Sidebar" style="display: none;">▶</button>
  <div id="chart-container"></div>
`

const container = document.getElementById('chart-container')!;
const sidebar = document.getElementById('sidebar')!;
const btnToggle = document.getElementById('btn-toggle-sidebar')!;
const floatToggle = document.getElementById('float-toggle-btn')!;

const toggleSidebar = () => {
  sidebar.classList.toggle('collapsed');
  const isCollapsed = sidebar.classList.contains('collapsed');
  floatToggle.style.display = isCollapsed ? 'flex' : 'none';
};

btnToggle.addEventListener('click', toggleSidebar);
floatToggle.addEventListener('click', toggleSidebar);

// Mock Data Generation (Chinese / Localized / 5-Centers)
function createMockData(targetCount: number = 60): OrgChartNodeData[] {
  const data: OrgChartNodeData[] = [];
  let nextId = 1;
  const generateId = () => String(nextId++);

  const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Root
  const rootId = generateId();
  data.push({
    id: rootId,
    parentId: null,
    name: '张立德',
    title: '创始人 & CEO',
    // @ts-ignore
    _childrenCount: 0,
    // @ts-ignore
    _centerType: 'ceo'
  });

  // Departments with mapped type
  const departments = [
    { name: '总经办', leadTitle: '主任', staffTitle: '助理', type: 'admin' },
    { name: '财务部', leadTitle: '财务总监', staffTitle: '会计', type: 'admin' },
    { name: '后勤部', leadTitle: '行政总监', staffTitle: '行政专员', type: 'admin' },
    { name: '市场部', leadTitle: '市场VP', staffTitle: '销售经理', type: 'sales' },
    { name: '企业文化部', leadTitle: '总监', staffTitle: '文化专员', type: 'admin' },
    { name: '人力资源部', leadTitle: 'HRD', staffTitle: 'HRBP', type: 'admin' },
    { name: '产品部', leadTitle: '产品总监', staffTitle: '产品经理', type: 'product' },
    { name: '研发中心', leadTitle: 'CTO', staffTitle: '高级工程师', type: 'rnd' }
  ];

  const surnames = ['王', '李', '陈', '刘', '赵', '周', '吴', '郑', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗'];
  const givenNames = ['伟', '芳', '娜', '敏', '静', '秀', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '平', '刚', '桂英'];

  const getName = () => {
    const s = surnames[randomInt(0, surnames.length - 1)];
    const n = givenNames[randomInt(0, givenNames.length - 1)];
    return s + n;
  };

  // Create Dept Heads (Level 1)
  const deptNodes: any[] = [];

  departments.forEach(dept => {
    const id = generateId();
    const node = {
      id,
      parentId: rootId,
      name: getName(),
      title: dept.leadTitle,
      _deptName: dept.name,
      _staffTitle: dept.staffTitle,
      _centerType: dept.type
    };
    data.push(node);
    deptNodes.push(node);
  });

  // Fill remaining count with staff (Level 2+)
  while (nextId <= targetCount) {
    // Pick a random department
    const deptNode = deptNodes[randomInt(0, deptNodes.length - 1)];

    let parentId = deptNode.id;

    // 20% chance to be under another staff member in that dept if any exist
    const existingStaffInDept = data.filter(d => (d as any)._deptName === deptNode._deptName && d.id !== deptNode.id);
    if (existingStaffInDept.length > 0 && Math.random() > 0.8) {
      parentId = existingStaffInDept[randomInt(0, existingStaffInDept.length - 1)].id;
    }

    const id = generateId();
    // Special Logic for R&D titles
    let title = deptNode._staffTitle;
    if (deptNode._deptName === '研发中心') {
      const rTitles = ['前端工程师', '后端工程师', '测试工程师', '算法工程师', '架构师'];
      title = rTitles[randomInt(0, rTitles.length - 1)];
    }

    data.push({
      id,
      parentId,
      name: getName(),
      title: title,
      // @ts-ignore
      _deptName: deptNode._deptName,
      // @ts-ignore
      _centerType: deptNode._centerType
    });
  }

  // Calculate children counts
  const idMap = new Map();
  data.forEach(d => {
    idMap.set(d.id, d);
    (d as any)._childrenCount = 0;
  });

  data.forEach(d => {
    if (d.parentId && idMap.has(d.parentId)) {
      const p = idMap.get(d.parentId);
      p._childrenCount++;
    }
  });

  return data.map(d => ({
    id: d.id,
    parentId: d.parentId,
    name: `${d.name} ${(d as any)._deptName ? `[${(d as any)._deptName}]` : ''}`,
    title: d.title,
    _childrenCount: (d as any)._childrenCount,
    _centerType: (d as any)._centerType
  }));
}

const data = createMockData(80);

const templates: Record<string, (d: OrgChartNodeData) => string> = {
  'dept': renderDepartmentCard,
  'company': renderCompanyCard,
  'group': renderGroupCard,
  'center': renderCenterCard
};

let currentTemplate = 'center';

const chart = new OrgChart(container, {
  nodeWidth: 200,
  nodeHeight: 100,
  nodeSpacingX: 30,
  nodeSpacingY: 60,
  renderContent: (d) => templates[currentTemplate](d),
  onNodeClick: (id) => console.log('Clicked:', id),
  onNodeDrop: (src, tgt) => {
    console.log(`Dropped ${src} on ${tgt}`);
    return true;
  },
  onDataChange: (data) => {
    console.log('Data structure changed', data);
  }
});

// Menu Implementation
const menu = document.createElement('div');
menu.id = 'node-action-menu';
menu.style.cssText = `
    position: fixed;
    background: white;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
    border-radius: 6px;
    display: none;
    z-index: 2000;
    min-width: 140px;
    overflow: hidden;
`;
document.body.appendChild(menu);

let activeMenuNodeId: string | null = null;

const hideMenu = () => {
  menu.style.display = 'none';
  activeMenuNodeId = null;
};

// Event Delegation for Menu Trigger
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const trigger = target.closest('.org-card-menu-trigger') as HTMLElement;

  if (trigger) {
    event.stopPropagation();
    const nodeId = trigger.dataset.nodeId;
    if (!nodeId) return;

    activeMenuNodeId = nodeId;
    const rect = trigger.getBoundingClientRect();

    // Check mode
    if (isEdit) {
      menu.innerHTML = `
        <div class="menu-item" data-action="edit">Edit Details</div>
        <div class="menu-item" data-action="add">Add Child</div>
        <div style="height: 1px; background: #e2e8f0; margin: 4px 0;"></div>
        <div class="menu-item text-danger" data-action="delete">Delete Node</div>
      `;
    } else {
      menu.innerHTML = `
        <div class="menu-item" data-action="view">View Details</div>
      `;
    }

    menu.style.display = 'block';

    // Position menu to the right/bottom of trigger
    let left = rect.right + 4;
    let top = rect.top;

    if (left + 140 > window.innerWidth) {
      left = rect.left - 144;
    }
    if (top + menu.offsetHeight > window.innerHeight) {
      top = window.innerHeight - menu.offsetHeight - 8;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

  } else if (!target.closest('#node-action-menu')) {
    hideMenu();
  }
});

// Add styles for menu items dynamically
const menuStyle = document.createElement('style');
menuStyle.textContent = `
  .menu-item {
    padding: 10px 16px;
    cursor: pointer;
    font-size: 14px;
    color: #334155;
    transition: background 0.2s;
  }
  .menu-item:hover { background: #f1f5f9; }
  .menu-item.text-danger { color: #ef4444; }
  .menu-item.text-danger:hover { background: #fee2e2; }
`;
document.head.appendChild(menuStyle);

// Handle menu actions
menu.addEventListener('click', async (event) => {
  const target = event.target as HTMLElement;
  const item = target.closest('.menu-item') as HTMLElement;
  if (!item || !activeMenuNodeId) return;

  const action = item.dataset.action;
  const nodeId = activeMenuNodeId;
  hideMenu();

  if (action === 'edit') showToast(`Editing node ${nodeId}`);
  if (action === 'view') showToast(`Viewing node ${nodeId}`);
  if (action === 'add') showToast(`Adding child to ${nodeId}`);
  if (action === 'delete') {
    const confirm = await showConfirm('Delete Node', 'Are you sure you want to delete this node? This action cannot be undone immediately.');
    if (confirm) {
      showToast(`Node ${nodeId} deleted`, 'warning');
      // In Sprint 2, we will actually remove from draft state
    }
  }
});

chart.render(data);

// Control Logic
document.getElementById('btn-fit')?.addEventListener('click', () => {
  chart.fitToScreen();
});

let isEdit = false;
const btnMode = document.getElementById('btn-mode')!;
btnMode.addEventListener('click', () => {
  isEdit = !isEdit;
  chart.setMode(isEdit ? 'edit' : 'view');

  if (isEdit) {
    btnMode.textContent = 'Mode: Edit';
    btnMode.classList.add('active');
    showToast('Entered Edit Mode', 'warning');
  } else {
    btnMode.textContent = 'Mode: View';
    btnMode.classList.remove('active');
    showToast('Returned to View Mode');
  }
});

document.getElementById('sel-template')?.addEventListener('change', (e) => {
  const val = (e.target as HTMLSelectElement).value;
  currentTemplate = val;
  chart.render(data);
  showToast(`Template changed to ${val}`);
});

// Search Logic
const inpSearch = document.getElementById('inp-search') as HTMLInputElement;
const btnSearch = document.getElementById('btn-search') as HTMLButtonElement;
const searchResults = document.getElementById('search-results') as HTMLDivElement;

let searchTimeout: ReturnType<typeof setTimeout>;

const performSearch = (query: string) => {
  if (!query.trim()) {
    searchResults.classList.remove('active');
    return;
  }

  query = query.toLowerCase();

  // Filter data (up to 10 results)
  const matches = data.filter(d =>
    d.name.toLowerCase().includes(query) ||
    d.title.toLowerCase().includes(query) ||
    d.id.includes(query)
  ).slice(0, 10);

  renderSearchResults(matches);
};

const renderSearchResults = (matches: any[]) => {
  searchResults.innerHTML = '';

  if (matches.length === 0) {
    searchResults.innerHTML = '<div class="search-empty">No results found</div>';
  } else {
    matches.forEach(match => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <div class="search-result-name">${match.name}</div>
        <div class="search-result-meta">
          <span style="color: #3b82f6;">${match.title}</span>
          <span>ID: ${match.id}</span>
        </div>
      `;
      item.addEventListener('click', () => {
        chart.centerNode(match.id);
        searchResults.classList.remove('active');
        inpSearch.value = match.name.split(' ')[0]; // simplify input to name
      });
      searchResults.appendChild(item);
    });
  }

  searchResults.classList.add('active');
};

inpSearch.addEventListener('input', (e) => {
  const val = (e.target as HTMLInputElement).value;
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    performSearch(val);
  }, 200); // debounce
});

btnSearch.addEventListener('click', () => {
  performSearch(inpSearch.value);
});

inpSearch.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    performSearch(inpSearch.value);
  }
});

// Close search results when clicking outside
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.search-container')) {
    searchResults.classList.remove('active');
  }
});
