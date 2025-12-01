'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function PriceChart({ priceHistory }) {
  if (!priceHistory || priceHistory.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No price history available
      </div>
    );
  }

  // Reverse array to show oldest to newest (left to right)
  const sortedHistory = [...priceHistory].reverse();

  // Format dates for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const labels = sortedHistory.map(item => formatDate(item.created_at));
  const regularData = sortedHistory.map(item => parseFloat(item.price_usd));
  const foilData = sortedHistory.map(item => parseFloat(item.price_usd_foil));

  const chartData = {
    labels: labels,
    datasets: [
      {
        label: 'Regular (USD)',
        data: regularData,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        spanGaps: true,
        pointRadius: 3,
        pointHoverRadius: 5
      },
      {
        label: 'Foil (USD)',
        data: foilData,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        spanGaps: true,
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ].filter(dataset => dataset.data.some(value => value > 0))
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#F8FAFC'
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += '$' + context.parsed.y.toFixed(2);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '$' + value.toFixed(2);
          },
          color: '#F8FAFC'
        },
        grid: {
          color: 'hsl(var(--border))'
        }
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: '#F8FAFC'
        },
        grid: {
          color: 'hsl(var(--border))'
        }
      }
    }
  };

  return (
    <div className="h-64">
      <Line data={chartData} options={options} />
    </div>
  );
}