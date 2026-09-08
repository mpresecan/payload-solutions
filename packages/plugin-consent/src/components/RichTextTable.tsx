import type { CSSProperties, ReactNode } from 'react'

/**
 * Lexical table nodes, as produced by `EXPERIMENTAL_TableFeature` (and by the
 * markdown transformer that seeds the legal documents).
 *
 * `headerState` is a bitmask: 1 = header row cell, 2 = header column cell.
 *
 * `version` is declared even though nothing here reads it: without it these converters are not
 * assignable to the host's `JSXConverters` map, because the host's `nodesToJSX` demands
 * `SerializedLexicalNode[]` and a node type missing a required property fails contravariantly.
 * Hosts would have to cast, which defeats the point of exporting them.
 */
type LexicalNode = { type: string; version: number; [key: string]: unknown }
type TableCellNode = LexicalNode & { backgroundColor?: null | string; colSpan?: number; headerState?: number; rowSpan?: number }
type TableRowNode = LexicalNode & { children?: TableCellNode[] }
type TableNode = LexicalNode & { children?: TableRowNode[] }

type NodesToJSX = (args: { nodes: LexicalNode[] }) => ReactNode

const HEADER_ROW = 1
const HEADER_COLUMN = 2

const isHeaderRow = (row: TableRowNode): boolean =>
  Boolean(row.children?.length) && row.children!.every((cell) => ((cell.headerState ?? 0) & HEADER_ROW) !== 0)

function renderCell(cell: TableCellNode, index: number, nodesToJSX: NodesToJSX): ReactNode {
  const headerState = cell.headerState ?? 0
  const Tag = headerState > 0 ? 'th' : 'td'
  const style: CSSProperties | undefined = cell.backgroundColor ? { backgroundColor: cell.backgroundColor } : undefined
  return (
    <Tag
      colSpan={cell.colSpan && cell.colSpan > 1 ? cell.colSpan : undefined}
      key={index}
      rowSpan={cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined}
      scope={headerState > 0 ? ((headerState & HEADER_ROW) !== 0 ? 'col' : 'row') : undefined}
      style={style}
    >
      {nodesToJSX({ nodes: (cell.children as LexicalNode[]) ?? [] })}
    </Tag>
  )
}

function renderRow(row: TableRowNode, index: number, nodesToJSX: NodesToJSX): ReactNode {
  return <tr key={index}>{(row.children ?? []).map((cell, i) => renderCell(cell, i, nodesToJSX))}</tr>
}

/**
 * Renders a Lexical table as a real `<table>` with `<thead>`/`<tbody>` and
 * `scope`-annotated `<th>`s, wrapped in a horizontally scrollable container so
 * a five-column retention table cannot break a narrow layout.
 *
 * Unlike Lexical's built-in table converter this carries no hard-coded colours
 * or padding, so it inherits your typography and works in dark mode. Style it
 * through `[data-lexical-table]` (the wrapper carries `[data-lexical-table-container]`).
 */
export function RichTextTable({ node, nodesToJSX }: { node: TableNode; nodesToJSX: NodesToJSX }): ReactNode {
  const rows = node.children ?? []
  const headerCount = rows.findIndex((row) => !isHeaderRow(row))
  const headerRows = headerCount === -1 ? rows : rows.slice(0, headerCount)
  const bodyRows = headerCount === -1 ? [] : rows.slice(headerCount)

  return (
    <div data-lexical-table-container="" style={{ maxWidth: '100%', overflowX: 'auto' }}>
      <table data-lexical-table="" style={{ borderCollapse: 'collapse', width: '100%' }}>
        {headerRows.length > 0 ? <thead>{headerRows.map((row, i) => renderRow(row, i, nodesToJSX))}</thead> : null}
        {bodyRows.length > 0 ? <tbody>{bodyRows.map((row, i) => renderRow(row, i, nodesToJSX))}</tbody> : null}
      </table>
    </div>
  )
}

/**
 * Lexical JSX converters for table nodes. Spread after `defaultConverters` to
 * replace Lexical's inline-styled table output:
 *
 *   converters={({ defaultConverters }) => ({ ...defaultConverters, ...consentTableConverters })}
 */
export const consentTableConverters = {
  table: ({ node, nodesToJSX }: { node: TableNode; nodesToJSX: NodesToJSX }): ReactNode => (
    <RichTextTable node={node} nodesToJSX={nodesToJSX} />
  ),
  // Rows and cells are rendered by the table converter above; these are here so
  // a stray row or cell outside a table cannot fall through to Lexical's styled
  // defaults.
  tablecell: ({ node, nodesToJSX }: { node: TableCellNode; nodesToJSX: NodesToJSX }): ReactNode => renderCell(node, 0, nodesToJSX),
  tablerow: ({ node, nodesToJSX }: { node: TableRowNode; nodesToJSX: NodesToJSX }): ReactNode => renderRow(node, 0, nodesToJSX),
}
