import './style.css'
import { OrgChart } from './org-chart/OrgChart';
import type { OrgChartNodeData } from './org-chart/types';
import { renderDepartmentCard, renderCompanyCard, renderGroupCard, renderCenterCard } from './org-chart/templates';

interface WindowWithMenu extends Window {
  toggleNodeMenu?: (event: MouseEvent, nodeId: string) => void;
  hideNodeMenu?: () => void;
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="chart-container"></div>
  <div id="controls">
    <button id="btn-fit">Fit Screen</button>
    <button id="btn-mode">Mode: View</button>
    <select id="sel-template" style="padding: 5px; border-radius: 4px; border: 1px solid #ccc;">
        <option value="center" selected>Template: 5-Centers (New)</option>
        <option value="dept">Template: Department</option>
        <option value="company">Template: Company</option>
        <option value="group">Template: Group</option>
    </select>
    <input type="text" id="inp-search" placeholder="Search ID..." />
    <button id="btn-search">Search</button>
  </div>
`

const container = document.getElementById('chart-container')!;
container.style.width = '100%';
container.style.height = '100vh';

// CSS for controls
const style = document.createElement('style');
style.textContent = `
  #controls {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    padding: 10px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    display: flex;
    gap: 8px;
    z-index: 1000;
    align-items: center;
  }
`;
document.head.appendChild(style);

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
    border: 1px solid #ddd;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    border-radius: 4px;
    display: none;
    z-index: 2000;
    min-width: 120px;
`;
menu.innerHTML = `
    <div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;" onclick="alert('Edit Clicked'); window.hideNodeMenu()">Edit</div>
    <div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #eee;" onclick="alert('Add Child Clicked'); window.hideNodeMenu()">Add Child</div>
    <div style="padding: 8px 12px; cursor: pointer; color: red;" onclick="alert('Delete Clicked'); window.hideNodeMenu()">Delete</div>
`;
document.body.appendChild(menu);

// Add global handlers (since we use onclick string in HTML)
const win = window as unknown as WindowWithMenu;

win.toggleNodeMenu = (event: MouseEvent, nodeId: string) => {
  event.stopPropagation(); // prevent node click
  console.log('Open menu for', nodeId);

  // Position menu near the click
  menu.style.display = 'block';
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;

  // Simple "click outside" closer
  const closer = () => {
    if (win.hideNodeMenu) win.hideNodeMenu();
    document.removeEventListener('click', closer);
  };
  // Timeout to avoid immediate trigger
  setTimeout(() => {
    document.addEventListener('click', closer);
  }, 0);
};

win.hideNodeMenu = () => {
  menu.style.display = 'none';
};

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
  btnMode.textContent = `Mode: ${isEdit ? 'Edit' : 'View'}`;
});

document.getElementById('sel-template')?.addEventListener('change', (e) => {
  const val = (e.target as HTMLSelectElement).value;
  currentTemplate = val;
  chart.render(data);
});

document.getElementById('btn-search')?.addEventListener('click', () => {
  const input = document.getElementById('inp-search') as HTMLInputElement;
  if (input.value) {
    chart.centerNode(input.value);
  }
});
