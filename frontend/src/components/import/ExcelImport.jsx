import React from 'react';

// Dashed-border file picker shared by the Excel/CSV import surfaces.
// Owns the hidden input (accept list included) and its label; callers
// pass their own frame classes via labelClassName and inner copy via
// children, so each page keeps its existing visuals.
const ExcelImport = ({ id, onChange, labelClassName, children }) => (
  <>
    <input
      type="file"
      id={id}
      accept=".xlsx,.xls,.csv"
      onChange={onChange}
      className="hidden"
    />
    <label htmlFor={id} className={labelClassName}>
      {children}
    </label>
  </>
);

export default ExcelImport;
