
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { OrgChart } from '../../plugin/OrgChart'; // Adjusted path
import type { OrgChartNodeData, OrgChartOptions } from '../../plugin/types';
import '../../plugin/styles.css'; // Adjusted path

interface OrgChartProps {
    data: OrgChartNodeData[];
    mode?: 'view' | 'edit';
    options?: Partial<OrgChartOptions>;
    onNodeClick?: (id: string) => void;
    onDataChange?: (data: OrgChartNodeData[]) => void;
}

export interface OrgChartHandle {
    fitToScreen: () => void;
    centerNode: (nodeId: string) => void;
    instance: OrgChart | null;
}

export const ReactOrgChart = forwardRef<OrgChartHandle, OrgChartProps>(({
    data,
    mode = 'view',
    options = {},
    onNodeClick,
    onDataChange
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartInstance = useRef<OrgChart | null>(null);

    // Initialize
    useEffect(() => {
        if (!containerRef.current) return;

        const chart = new OrgChart(containerRef.current, {
            nodeWidth: 200,
            nodeHeight: 120,
            nodeSpacingX: 40,
            nodeSpacingY: 80,
            renderContent: (d) => `
        <div class="custom-react-card" style="padding: 10px; background: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <div class="name" style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">${d.name}</div>
          <div class="title" style="color: #666; font-size: 14px;">${d.title || ''}</div>
        </div>
      `,
            ...options,
            onNodeClick,
            onDataChange: (newData) => {
                if (onDataChange) onDataChange(newData);
            }
        });

        chartInstance.current = chart;
        chart.render(data);

        return () => {
            if (containerRef.current) containerRef.current.innerHTML = '';
            chartInstance.current = null;
        };
    }, []); // Only run once on mount

    // Expose API
    useImperativeHandle(ref, () => ({
        fitToScreen: () => chartInstance.current?.fitToScreen(),
        centerNode: (id: string) => chartInstance.current?.centerNode(id),
        instance: chartInstance.current
    }));

    // Sync data
    useEffect(() => {
        chartInstance.current?.render(data);
    }, [data]);

    // Sync mode
    useEffect(() => {
        chartInstance.current?.setMode(mode);
    }, [mode]);

    return (
        <div
            ref={containerRef}
            className="org-chart-react-wrapper"
            style={{ width: '100%', height: '100%', minHeight: '500px', background: '#f8f9fa' }}
        />
    );
});
