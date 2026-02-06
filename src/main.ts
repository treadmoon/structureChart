import './style.css'
import { OrgChart } from './org-chart/OrgChart';
import type { OrgChartNodeData } from './org-chart/types';

interface WindowWithMenu extends Window {
  toggleNodeMenu?: (event: MouseEvent, nodeId: string) => void;
  hideNodeMenu?: () => void;
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="chart-container"></div>
  <div id="controls">
    <button id="btn-fit">Fit Screen</button>
    <button id="btn-mode">Mode: View</button>
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
  }
`;
document.head.appendChild(style);

// Mock Data Generation
function createMockData(count: number): OrgChartNodeData[] {
  const data: OrgChartNodeData[] = [];

  // Helper to get random int
  const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Use any to allow temporary properties like _childrenCount
  const root: any = { id: '1', parentId: null, name: 'CEO', title: 'President', _childrenCount: 0, _maxChildren: randomInt(3, 6) };
  data.push(root);

  let candidates: any[] = [root];
  let nextId = 2;

  while (nextId <= count) {
    if (candidates.length === 0) {
      // If we ran out of parents but haven't reached count, pick a random existing node and reopen it
      const luckyParent = data[randomInt(0, data.length - 1)] as any;
      luckyParent._maxChildren = (luckyParent._maxChildren || 0) + 3;
      candidates.push(luckyParent);
    }

    // Pick a random parent from candidates
    const pIndex = randomInt(0, candidates.length - 1);
    const parent = candidates[pIndex];

    // Create child
    const id = String(nextId++);

    // Determine Role based on id (rough approximation of hierarchy level not strictly tracked here, but random enough)
    const titles = ['VP', 'Director', 'Manager', 'Team Lead', 'Senior Eng', 'Engineer', 'Intern'];
    const title = titles[randomInt(0, titles.length - 1)];

    // Determine branching factor for this new node
    // 30% chance of being a leaf (0 children)
    // 70% chance of having children (1-8)
    let maxChi = 0;
    if (Math.random() > 0.3) {
      maxChi = randomInt(1, 8);
    }

    const child = {
      id,
      parentId: parent.id,
      name: `Emp ${id}`,
      title: title,
      _childrenCount: 0,
      _maxChildren: maxChi
    };

    data.push(child);

    // If child can have children, add to candidates
    if (child._maxChildren > 0) {
      candidates.push(child);
    }

    // Update parent stats
    parent._childrenCount = (parent._childrenCount || 0) + 1;
    if (parent._childrenCount >= parent._maxChildren) {
      // Parent is full, remove from candidates
      candidates.splice(pIndex, 1);
    }
  }

  // Clean up internal helper props
  return data.map(d => ({
    id: d.id,
    parentId: d.parentId,
    name: d.name,
    title: d.title
  }));
}

const data = createMockData(100);

const chart = new OrgChart(container, {
  nodeWidth: 200,
  nodeHeight: 100,
  nodeSpacingX: 30,
  nodeSpacingY: 60,
  renderContent: (d) => {
    return `
            <div style="
                background: white;
                height: 100%;
                width: 100%;
                border-radius: 4px;
                border: 1px solid #e0e0e0;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                overflow: hidden;
                position: relative;
            ">
                <div style="position: absolute; top: 5px; right: 5px; cursor: pointer; padding: 2px;"
                     onclick="window.toggleNodeMenu(event, '${d.id}')">
                   ⋮
                </div>
                <div style="font-weight: 600; color: #333;">${d.name}</div>
                <div style="font-size: 12px; color: #666;">${d['title']}</div>
            </div>
        `;
  },
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

document.getElementById('btn-search')?.addEventListener('click', () => {
  const input = document.getElementById('inp-search') as HTMLInputElement;
  if (input.value) {
    chart.centerNode(input.value);
  }
});
