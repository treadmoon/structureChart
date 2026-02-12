
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ReactOrgChart, type OrgChartHandle } from './OrgChartContainer';
import type { OrgChartNodeData } from '../../plugin/types';

// ==========================================
// 1. Mock Data Generator (100+ Nodes)
// ==========================================
function createMockData(count: number = 100): OrgChartNodeData[] {
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
        _dept: '总经办',
        _color: '#722ed1', // Purple for Executive
        _logo: '🏢',
        _avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CEO'
    });

    const departments = [
        { name: '研发中心', color: '#1890ff', logo: '💻', roles: ['架构师', '高级工程师', '前端专家', '后端专家', '测试经理'] },
        { name: '产品部', color: '#fa8c16', logo: '📱', roles: ['产品总监', '高级PM', '产品专员', 'UI设计师', 'UX研究员'] },
        { name: '市场部', color: '#eb2f96', logo: '📢', roles: ['市场VP', '营销总监', '品牌经理', '销售冠军', '推广专员'] },
        { name: '财务部', color: '#52c41a', logo: '💰', roles: ['CFO', '财务主管', '资深会计', '出纳', '审计'] },
        { name: '人力资源', color: '#13c2c2', logo: '👥', roles: ['HRD', 'HRBP', '招聘主管', '培训专员', '绩效专员'] },
        { name: '运营部', color: '#fadb14', logo: '📈', roles: ['运营总监', '内容运营', '活动运营', '用户运营', '客服主管'] }
    ];

    const surnames = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '褚', '卫', '蒋', '沈', '韩', '杨'];
    const names = ['伟', '芳', '娜', '敏', '静', '秀', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超'];

    const getName = () => surnames[randomInt(0, surnames.length - 1)] + names[randomInt(0, names.length - 1)];

    // Level 1: Department Heads
    const deptNodes: any[] = [];
    departments.forEach(dept => {
        const id = generateId();
        const node = {
            id,
            parentId: rootId,
            name: getName(),
            title: dept.roles[0], // Director/VP level
            _dept: dept.name,
            _color: dept.color,
            _logo: dept.logo,
            _avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`
        };
        data.push(node);
        deptNodes.push({ ...node, rawDept: dept });
    });

    // Level 2+: Staff
    while (nextId <= count) {
        const deptNode = deptNodes[randomInt(0, deptNodes.length - 1)];
        const deptInfo = deptNode.rawDept;
        let parentId = deptNode.id;

        const potentialParents = data.filter(d => (d as any)._dept === deptInfo.name && d.id !== rootId);
        if (potentialParents.length > 0 && Math.random() > 0.7) {
            parentId = potentialParents[randomInt(0, potentialParents.length - 1)].id;
        }

        const id = generateId();
        const title = deptInfo.roles[randomInt(1, deptInfo.roles.length - 1)];

        data.push({
            id,
            parentId,
            name: getName(),
            title: title,
            // @ts-ignore
            _dept: deptInfo.name,
            _color: deptInfo.color,
            _logo: deptInfo.logo,
            _avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`
        });
    }

    return data;
}

// ==========================================
// 2. Main Component
// ==========================================
export default function App() {
    const [chartData, setChartData] = useState<OrgChartNodeData[]>([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [menuState, setMenuState] = useState<{ nodeId: string, x: number, y: number } | null>(null);
    const chartRef = useRef<OrgChartHandle>(null);

    // Initialize
    useEffect(() => {
        const data = createMockData(120);
        setChartData(data);
    }, []);

    // Close menu on click outside
    useEffect(() => {
        const handleClick = () => setMenuState(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // ------------------------------------------
    // Custom Handlers
    // ------------------------------------------

    const handleNodeAdd = useCallback((parentId: string) => {
        const name = prompt('请输入新员工姓名:', '新员工');
        if (!name) return;

        const newId = String(Date.now());
        const parent = chartData.find(d => d.id === parentId);
        const dept = (parent as any)?._dept || '未定部门';
        const color = (parent as any)?._color || '#999';
        const logo = (parent as any)?._logo || '📝';

        const newNode: OrgChartNodeData = {
            id: newId,
            parentId: parentId,
            name: name,
            title: '普通员工',
            // @ts-ignore
            _dept: dept,
            _color: color,
            _logo: logo,
            _avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newId}`
        };

        setChartData(prev => [...prev, newNode]);
        setTimeout(() => chartRef.current?.centerNode(newId), 300);
        setMenuState(null);
    }, [chartData]);

    const handleNodeEdit = useCallback((nodeId: string) => {
        const node = chartData.find(d => d.id === nodeId);
        if (!node) return;

        const newName = prompt('修改姓名:', node.name);
        if (newName === null) return;

        const newTitle = prompt('修改职位:', node.title);
        if (newTitle === null) return;

        setChartData(prev => prev.map(d => {
            if (d.id === nodeId) {
                return { ...d, name: newName || d.name, title: newTitle || d.title };
            }
            return d;
        }));
        setMenuState(null);
    }, [chartData]);

    const handleNodeDelete = useCallback((nodeId: string) => {
        if (!confirm('确定要删除此节点及其子节点吗？')) return;

        const toDelete = new Set<string>();
        const findDescendants = (pid: string, currentData: OrgChartNodeData[]) => {
            toDelete.add(pid);
            currentData.filter(d => d.parentId === pid).forEach(child => findDescendants(child.id, currentData));
        };

        setChartData(prev => {
            findDescendants(nodeId, prev);
            return prev.filter(d => !toDelete.has(d.id));
        });
        setMenuState(null);
    }, []);

    const handleSearch = () => {
        if (!searchText.trim()) return;
        const target = chartData.find(d => d.name.includes(searchText));
        if (target) {
            chartRef.current?.centerNode(target.id);
        } else {
            alert('未找到相关人员');
        }
    };

    const handleShowMenu = useCallback((e: MouseEvent, nodeId: string) => {
        e.stopPropagation();
        e.preventDefault();
        // Calculate position relative to viewport
        setMenuState({
            nodeId,
            x: e.clientX,
            y: e.clientY
        });
    }, []);

    // ------------------------------------------
    // Render Function 
    // ------------------------------------------
    const renderCard = useCallback((d: OrgChartNodeData) => {
        const color = (d as any)._color || '#8c8c8c';
        const dept = (d as any)._dept || '公司高层';
        const logo = (d as any)._logo || '🏢';
        const avatar = (d as any)._avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback';

        const div = document.createElement('div');
        div.className = 'org-node-card';
        div.style.cssText = `
            width: 100%; height: 100%;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.08);
            display: flex; flex-direction: row;
            border: 1px solid #f0f0f0;
            position: relative;
            overflow: hidden;
            transition: all 0.2s;
        `;

        // Left Colored Border
        const borderLeft = document.createElement('div');
        borderLeft.style.cssText = `width: 6px; height: 100%; background: ${color}; flex-shrink: 0;`;
        div.appendChild(borderLeft);

        // Content Area 
        const content = document.createElement('div');
        content.style.cssText = `
            flex: 1; padding: 12px;
            display: flex; align-items: center; gap: 12px;
        `;
        div.appendChild(content);

        // Avatar
        const img = document.createElement('img');
        img.src = avatar;
        img.style.cssText = `
            width: 48px; height: 48px; 
            border-radius: 50%; border: 2px solid ${color}; 
            padding: 2px; flex-shrink: 0;
            background: #fff;
        `;
        content.appendChild(img);

        // Info
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = `display: flex; flex-direction: column; justify-content: center; gap: 2px; flex: 1; min-width: 0;`;
        infoDiv.innerHTML = `
            <div style="font-weight: bold; font-size: 15px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${d.name}</div>
            <div style="font-size: 12px; color: #666; background: #f5f5f5; border-radius: 4px; padding: 1px 6px; align-self: flex-start;">${d.title}</div>
            <div style="font-size: 12px; color: #999; margin-top: 2px;">${logo} ${dept}</div>
        `;
        content.appendChild(infoDiv);

        // Menu Button
        const menuBtn = document.createElement('div');
        menuBtn.innerHTML = '⋮';
        menuBtn.style.cssText = `
            position: absolute; top: 4px; right: 4px;
            width: 24px; height: 24px; 
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; color: #999; font-weight: bold;
            border-radius: 4px;
        `;
        menuBtn.onmouseover = () => { menuBtn.style.background = '#f0f0f0'; menuBtn.style.color = '#333'; };
        menuBtn.onmouseout = () => { menuBtn.style.background = 'transparent'; menuBtn.style.color = '#999'; };
        menuBtn.onclick = (e) => handleShowMenu(e, d.id);
        div.appendChild(menuBtn);

        return div;
    }, [handleShowMenu]);


    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f7fa' }}>
            {/* Header / Toolbar */}
            <div style={{
                padding: '12px 24px', background: 'white', borderBottom: '1px solid #e8e8e8',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)', zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1f1f1f' }}>
                        <span>⚛️</span> 组织架构管理
                    </h2>

                    <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f5', borderRadius: '6px', padding: '4px 8px', border: '1px solid #d9d9d9' }}>
                        <span style={{ marginRight: '6px' }}>🔍</span>
                        <input
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="输入姓名搜索..."
                            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14px', width: '150px' }}
                        />
                        <button onClick={handleSearch} style={{ border: 'none', background: 'transparent', color: '#1890ff', cursor: 'pointer', fontWeight: 500 }}>定位</button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setIsEditMode(!isEditMode)}
                        style={{ padding: '6px 16px', background: isEditMode ? '#ff4d4f' : '#1890ff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.3s', fontWeight: 500, boxShadow: '0 2px 4px rgba(24,144,255,0.2)' }}>
                        {isEditMode ? '🔓 退出拖拽' : '🔒 开启拖拽'}
                    </button>
                    <button onClick={() => chartRef.current?.fitToScreen()}
                        style={{ padding: '6px 16px', background: 'white', border: '1px solid #d9d9d9', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#595959' }}>
                        <span>👁️</span> 自适应
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <ReactOrgChart
                    ref={chartRef}
                    data={chartData}
                    mode={isEditMode ? 'edit' : 'view'}
                    onDataChange={(newData) => setChartData(newData)}
                    options={{
                        nodeWidth: 260,
                        nodeHeight: 100,
                        nodeSpacingX: 40,
                        nodeSpacingY: 60,
                        renderContent: renderCard,
                        defaultExpandDepth: 2 // Collapse deeper levels for performance
                    }}
                />

                <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(255,255,255,0.9)', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', backdropFilter: 'blur(4px)' }}>
                    📊 节点总数: <b>{chartData.length}</b>
                </div>

                {/* Dropdown Menu */}
                {menuState && (
                    <div
                        style={{
                            position: 'fixed',
                            top: menuState.y,
                            left: menuState.x,
                            background: 'white',
                            border: '1px solid #eee',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            borderRadius: '6px',
                            zIndex: 1000,
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: '120px',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking menu itself
                    >
                        <button
                            onClick={() => handleNodeAdd(menuState.nodeId)}
                            style={{
                                padding: '10px 16px', border: 'none', background: 'white', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#333', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                            <span role="img" aria-label="add">➕</span> 新增下级
                        </button>
                        <button
                            onClick={() => handleNodeEdit(menuState.nodeId)}
                            style={{
                                padding: '10px 16px', border: 'none', background: 'white', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#333', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                            <span role="img" aria-label="edit">✏️</span> 编辑信息
                        </button>
                        <div style={{ height: '1px', background: '#eee', margin: '0' }} />
                        <button
                            onClick={() => handleNodeDelete(menuState.nodeId)}
                            style={{
                                padding: '10px 16px', border: 'none', background: 'white', textAlign: 'left', cursor: 'pointer', fontSize: '14px', color: '#ff4d4f', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#fff1f0'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                            <span role="img" aria-label="delete">🗑️</span> 删除节点
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
