import { createLogger } from './logger';

const logger = createLogger('chart-renderer');

interface ChartData {
    type: string;
    title?: string;
    data: Array<{ name: string; value?: number; x?: number; y?: number; z?: number; status?: string }>;
}

const COLORS = ['#4F81BD', '#C0504D', '#9BBB59', '#8064A2', '#4BACC6', '#F79646', '#2C4770', '#772C2C', '#31849B', '#7F7F7F'];

export async function renderChartToBase64(chart: ChartData): Promise<string | null> {
    let config: any;

    if (chart.type === 'bar') {
        config = {
            type: 'bar',
            data: {
                labels: chart.data.map(d => d.name),
                datasets: [{
                    label: chart.title || 'Dados',
                    data: chart.data.map(d => d.value ?? 0),
                    backgroundColor: COLORS,
                }],
            },
            options: {
                plugins: {
                    title: { display: !!chart.title, text: chart.title, font: { size: 14 } },
                    legend: { display: false },
                },
                scales: { y: { beginAtZero: true } },
            },
        };
    } else if (chart.type === 'pie') {
        config = {
            type: 'pie',
            data: {
                labels: chart.data.map(d => d.name),
                datasets: [{
                    data: chart.data.map(d => d.value ?? 0),
                    backgroundColor: COLORS,
                }],
            },
            options: {
                plugins: {
                    title: { display: !!chart.title, text: chart.title, font: { size: 14 } },
                },
            },
        };
    } else if (chart.type === 'scatter') {
        // Matriz de risco: agrupa por quadrante
        const quadrants: Record<string, number> = { 'Crítico': 0, 'Alto Risco': 0, 'Moderado': 0, 'Baixo Risco': 0 };
        for (const p of chart.data) {
            const x = p.x ?? 0;
            const y = p.y ?? 0;
            if (x >= 7 && y >= 7) quadrants['Crítico']++;
            else if (x >= 5 || y >= 5) quadrants['Alto Risco']++;
            else if (x >= 3 || y >= 3) quadrants['Moderado']++;
            else quadrants['Baixo Risco']++;
        }
        config = {
            type: 'bar',
            data: {
                labels: Object.keys(quadrants),
                datasets: [{
                    label: 'Projetos',
                    data: Object.values(quadrants),
                    backgroundColor: ['#C0504D', '#F79646', '#9BBB59', '#4F81BD'],
                }],
            },
            options: {
                plugins: {
                    title: { display: true, text: chart.title || 'Matriz de Risco', font: { size: 14 } },
                    legend: { display: false },
                },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
            },
        };
    }

    if (!config) {
        logger.warn(`Tipo de gráfico não suportado: ${chart.type}`);
        return null;
    }

    try {
        const response = await fetch('https://quickchart.io/chart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chart: config, width: 600, height: 400, format: 'png', backgroundColor: 'white' }),
        });

        if (!response.ok) {
            logger.error(`QuickChart error: ${response.status} ${await response.text()}`);
            return null;
        }

        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
    } catch (err) {
        logger.error('Falha ao gerar gráfico via QuickChart', err);
        return null;
    }
}
