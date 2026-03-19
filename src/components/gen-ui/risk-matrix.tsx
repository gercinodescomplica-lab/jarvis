"use client"

import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface RiskPoint {
    name: string;
    x: number; // e.g. Impact/Importance (1-10)
    y: number; // e.g. Urgency/Probability (1-10)
    z: number; // Size/Bubble
    status: string;
}

interface RiskMatrixProps {
    data: RiskPoint[];
    title?: string;
}

export function RiskMatrix({ data, title = "Matriz de Risco" }: RiskMatrixProps) {
    if (!data || data.length === 0) return null;

    return (
        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 my-2 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{title}</h4>
                <div className="flex gap-2 text-[10px] text-neutral-400">
                    <span>X: Importância</span>
                    <span>Y: Urgência</span>
                </div>
            </div>

            <div className="h-[300px] w-full relative">
                {/* Quadrant Backgrounds (CSS) */}
                <div className="absolute inset-4 grid grid-cols-2 grid-rows-2 opacity-5 pointer-events-none">
                    <div className="bg-green-500 rounded-tl-lg"></div> {/* Low/High - Wait */}
                    <div className="bg-red-500 rounded-tr-lg"></div>   {/* High/High - Do Now */}
                    <div className="bg-gray-200 rounded-bl-lg"></div>   {/* Low/Low - Ignore */}
                    <div className="bg-yellow-500 rounded-br-lg"></div> {/* High/Low - Plan */}
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis type="number" dataKey="x" name="Importância" domain={[0, 10]} hide />
                        <YAxis type="number" dataKey="y" name="Urgência" domain={[0, 10]} hide />
                        <ZAxis type="number" dataKey="z" range={[50, 400]} />
                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                        <div className="bg-white dark:bg-neutral-800 p-2 border border-neutral-200 dark:border-neutral-700 rounded shadow-lg text-xs">
                                            <p className="font-bold mb-1">{d.name}</p>
                                            <p>Importância: {d.x}</p>
                                            <p>Urgência: {d.y}</p>
                                            <p className="text-neutral-400 mt-1">{d.status}</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Scatter name="Projetos" data={data} fill="#8884d8">
                            {data.map((entry, index) => {
                                let color = "#8884d8";
                                if (entry.x > 7 && entry.y > 7) color = "#ef4444"; // Red (Critical)
                                else if (entry.x > 5 || entry.y > 5) color = "#eab308"; // Yellow (Warning)
                                else color = "#22c55e"; // Green (OK)
                                return <Cell key={`cell-${index}`} fill={color} />
                            })}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
