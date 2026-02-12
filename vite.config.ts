import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            // 指定组件编译入口文件
            entry: resolve('src/plugin/index.ts'),
            // 组件库名称
            name: 'OrgChart',
            // 文件名称
            fileName: (format) => `org-chart.${format}.js`,
            formats: ['es', 'umd']
        },
        rollupOptions: {
            // 确保外部化处理那些你不想打包进库的依赖
            external: ['d3', 'react', 'react-dom'],
            output: {
                // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
                globals: {
                    d3: 'd3',
                    react: 'React',
                    'react-dom': 'ReactDOM'
                }
            }
        }
    }
});
