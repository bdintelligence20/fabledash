import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';

/* -------------------------------------------------------------------------- */
/*  Table root                                                                 */
/* -------------------------------------------------------------------------- */

export interface TableProps extends HTMLAttributes<HTMLTableElement> {}

function TableRoot({ className = '', children, ...props }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm text-left ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

TableRoot.displayName = 'Table';

/* -------------------------------------------------------------------------- */
/*  Head                                                                       */
/* -------------------------------------------------------------------------- */

function Head({ className = '', children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-surface-50 border-b border-surface-200 ${className}`} {...props}>
      {children}
    </thead>
  );
}

Head.displayName = 'Table.Head';

/* -------------------------------------------------------------------------- */
/*  Body                                                                       */
/* -------------------------------------------------------------------------- */

export interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  striped?: boolean;
}

function Body({ striped = false, className = '', children, ...props }: TableBodyProps) {
  return (
    <tbody
      className={`${striped ? '[&>tr:nth-child(even)]:bg-surface-50' : ''} ${className}`}
      {...props}
    >
      {children}
    </tbody>
  );
}

Body.displayName = 'Table.Body';

/* -------------------------------------------------------------------------- */
/*  Row                                                                        */
/* -------------------------------------------------------------------------- */

function Row({ className = '', children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`border-b border-surface-100 hover:bg-surface-50 transition-colors ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

Row.displayName = 'Table.Row';

/* -------------------------------------------------------------------------- */
/*  HeaderCell                                                                 */
/* -------------------------------------------------------------------------- */

function HeaderCell({ className = '', children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`px-4 py-3 text-label font-semibold text-surface-600 uppercase tracking-wider text-xs ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

HeaderCell.displayName = 'Table.HeaderCell';

/* -------------------------------------------------------------------------- */
/*  Cell                                                                       */
/* -------------------------------------------------------------------------- */

function Cell({ className = '', children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 text-surface-700 ${className}`} {...props}>
      {children}
    </td>
  );
}

Cell.displayName = 'Table.Cell';

/* -------------------------------------------------------------------------- */
/*  Export                                                                      */
/* -------------------------------------------------------------------------- */

export const Table = Object.assign(TableRoot, {
  Head,
  Body,
  Row,
  HeaderCell,
  Cell,
});
