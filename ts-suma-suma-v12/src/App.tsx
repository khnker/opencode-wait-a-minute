import React, { useState, useEffect } from 'react';

interface Calculation {
  id: string;
  expression: string;
  result: string;
  timestamp: string;
}

export default function App() {
  const [display, setDisplay] = useState<string>('0');
  const [equation, setEquation] = useState<string>('');
  const [history, setHistory] = useState<Calculation[]>(() => {
    const saved = localStorage.getItem('calc_history');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('calc_history', JSON.stringify(history));
  }, [history]);

  const handleNumber = (num: string) => {
    setDisplay(prev => (prev === '0' ? num : prev + num));
  };

  const handleOperator = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
  };

  const handleCalculate = () => {
    try {
      const fullExpr = equation + display;
      // Safe evaluation for basic calculator operations
      const evalResult = String(Function('"use strict";return (' + fullExpr.replace(/×/g, '*').replace(/÷/g, '/') + ')')());
      
      const newCalc: Calculation = {
        id: Date.now().toString(),
        expression: fullExpr,
        result: evalResult,
        timestamp: new Date().toLocaleTimeString(),
      };

      setHistory(prev => [newCalc, ...prev]);
      setDisplay(evalResult);
      setEquation('');
    } catch (e) {
      setDisplay('Error');
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('calc_history');
  };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '400px', margin: '40px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
      <h2>Calculadora ts-suma-suma-v12</h2>
      <div style={{ background: '#f4f4f4', padding: '15px', borderRadius: '4px', textAlign: 'right', marginBottom: '15px' }}>
        <div style={{ fontSize: '14px', color: '#666', minHeight: '20px' }}>{equation}</div>
        <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{display}</div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <button onClick={handleClear} style={{ gridColumn: 'span 2', padding: '15px', fontSize: '16px', background: '#ffcccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>C</button>
        <button onClick={() => handleOperator('÷')} style={{ padding: '15px', fontSize: '16px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>÷</button>
        <button onClick={() => handleOperator('×')} style={{ padding: '15px', fontSize: '16px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>×</button>

        <button onClick={() => handleNumber('7')} style={{ padding: '15px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>7</button>
        <button onClick={() => handleNumber('8')} style={{ padding: '15px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>8</button>
        <button onClick={() => handleNumber('9')} style={{ padding: '15px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>9</button>
        <button onClick={() => handleOperator('-')} style={{ padding: '15px', fontSize: '16px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>-</button>

        <button onClick={() => handleNumber('4')} style={{ padding: '15px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>4</button>
        <button onClick={() => handleNumber('5')} style={{ padding: '15px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>5</button>
        <button onClick={() => handleNumber('6')} style={{ padding: '15px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>6</button>
        <button onClick={() => handleOperator('+')} style={{ padding: '15px', fontSize: '16px', background: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+</button>

        <button onClick={() => handleNumber('1')} style={{ padding: '15px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>1</button>
        <button onClick={() => handleNumber('2')} style={{ padding: '15px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>2</button>
        <button onClick={() => handleNumber('3')} style={{ padding: '15px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>3</button>
        <button onClick={handleCalculate} style={{ gridRow: 'span 2', padding: '15px', fontSize: '16px', background: '#cce5ff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>=</button>

        <button onClick={() => handleNumber('0')} style={{ gridColumn: 'span 2', padding: '15px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>0</button>
        <button onClick={() => handleNumber('.')} style={{ padding: '15px', fontSize: '16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>.</button>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3>Historial de Cálculos</h3>
          {history.length > 0 && (
            <button onClick={clearHistory} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: '12px' }}>Limpiar Historial</button>
          )}
        </div>
        {history.length === 0 ? (
          <p style={{ color: '#888', fontSize: '14px' }}>No hay cálculos guardados.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, maxHeight: '150px', overflowY: 'auto' }}>
            {history.map(calc => (
              <li key={calc.id} style={{ padding: '8px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                <span>{calc.expression} = <strong>{calc.result}</strong></span>
                <span style={{ color: '#999', fontSize: '12px' }}>{calc.timestamp}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
