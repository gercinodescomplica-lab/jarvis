"use client"

import { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

interface ChartData {
    name: string;
    value: number;
    fill?: string;
}

interface DynamicChartProps {
    type: 'bar' | 'pie';
    data: ChartData[];
    title?: string;
    color?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function DynamicChart({ type, data, title, color = "#8884d8" }: DynamicChartProps) {

    if (!data || data.length === 0) return <div className="p-4 text-xs text-neutral-400">Sem dados para visualizar.</div>;

    return (
        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 my-2 shadow-sm">
            {title && <h4 className="text-sm font-semibold mb-4 text-neutral-700 dark:text-neutral-200">{title}</h4>}

            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {type === 'bar' ? (
                        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis type="number" fontSize={12} />
                            <YAxis dataKey="name" type="category" width={100} fontSize={12} tick={{ fill: '#888' }} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    ) : (
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
}
