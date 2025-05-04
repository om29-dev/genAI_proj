import React from 'react';
import './TableView.css';

export default function TableView({ columns, rows }) {
  if (!columns || columns.length === 0 || !rows || rows.length === 0) {
    return (
      <div className="table-responsive table-view-container border rounded p-3 text-center">
        <p className="text-muted mb-0 small fst-italic">No tabular data available for this query.</p>
      </div>
    );
  }

  return (
    <div className="table-responsive table-view-container border rounded">
      <table className="table table-striped table-hover table-sm mb-0">
        <thead className="table-dark">
          <tr>
            {columns.map(columnName => (
              <th key={columnName} scope="col" className="py-2 px-3">{columnName}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((dataRow, rowIndex) => (
            <tr key={dataRow.id || rowIndex}>
              {columns.map(columnName => (
                <td key={`${rowIndex}-${columnName}`} className="py-2 px-3">
                  {typeof dataRow[columnName] === 'boolean'
                    ? dataRow[columnName].toString()
                    : (dataRow[columnName] === null || dataRow[columnName] === undefined || dataRow[columnName] === '')
                      ? <span className="text-muted fst-italic small">N/A</span>
                      : String(dataRow[columnName])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
