# Structure Chart - Dynamic Organization Chart

Based on D3.js and TypeScript, this project provides a highly customizable, interactive organization chart component. It supports drag-and-drop editing, zooming/panning, node expansion/collapse, and multiple visual templates.

## ✨ Features

- **Interactive**:
  - 🖱️ **Pan & Zoom**: Smooth navigation using D3 zoom behaviors.
  - 📂 **Expand/Collapse**: Easily toggle visibility of child nodes with `+`/`-` buttons.
  - 🔍 **Search & Center**: Quickly locate and focus on specific nodes by ID.
- **Editable**:
  - ✋ **Drag & Drop**: Reorder siblings or reparent nodes visually in "Edit Mode".
  - 👻 **Visual Feedback**: Shows ghost card and clear drop indicators during drag operations.
- **Customizable**:
  - 🎨 **Multiple Templates**: Built-in templates for different styles:
    - **5-Centers**: Distinct styles for CEO, R&D, Sales, Product, and Admin depts.
    - **Group/Company/Department**: Traditional corporate styles.
  - 🛠️ **Framework Agnostic**: Written in Vanilla TS, easily integrated into React, Vue, or Angular.

## 🚀 Getting Started

### Prerequisites

- Node.js installed
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build

```bash
# Build for production
npm run build
```

## 📖 Usage

### Basic Initialization

```typescript
import { OrgChart } from './org-chart/OrgChart';

const container = document.getElementById('chart-container');
const data = [
  { id: '1', parentId: null, name: 'CEO' },
  { id: '2', parentId: '1', name: 'CTO' }
];

const chart = new OrgChart(container, {
  nodeWidth: 200,
  nodeHeight: 100,
  renderContent: (d) => `<div class="card">${d.name}</div>`,
  onNodeClick: (id) => console.log('Clicked', id)
});

chart.render(data);
```

### React Integration

See [REACT_USAGE.md](./REACT_USAGE.md) for a detailed guide on how to wrap this component for React applications.

## 📂 Project Structure

```
src/
├── org-chart/
│   ├── OrgChart.ts       # Core Logic (D3 layout, interactions)
│   ├── types.ts          # TypeScript Definitions
│   ├── templates.ts      # HTML Templates for Cards
│   └── styles.css        # Core styles & Themes
├── main.ts               # Demo application entry point
└── style.css             # Global styles
```

## 🛠️ API Options

| Option | Type | Description |
|--------|------|-------------|
| `nodeWidth` | `number` | Width of the node card (px). Default: 200 |
| `nodeHeight` | `number` | Height of the node card (px). Default: 100 |
| `renderContent` | `(data) => string` | Function returning HTML string for the node content. |
| `onNodeClick` | `(id) => void` | Callback when a node is clicked. |
| `onNodeDrop` | `(src, tgt) => void` | Callback when a node is dropped (Edit Mode). |

## 🤝 Contributing

Feel free to submit issues or pull requests to improve the chart rendering or add new features!
