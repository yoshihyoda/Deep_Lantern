import { Fragment } from 'react';
import { sourceById } from '@/lib/abyss/registry';
function Inline({ text }: { text: string }) {
  return (
    <>
      {text
        .replace(/https?:\/\/\S+/g, '[Inspect source registry]')
        .split(/(\*\*[^*]+\*\*|\[(?:gebco|noaa|obis)\])/g)
        .map((part, i) => {
          if (part.startsWith('**'))
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          const id = part.slice(1, -1),
            source = sourceById(id);
          if (source && part.startsWith('['))
            return (
              <a
                href={source.metadataUrl}
                target="_blank"
                rel="noreferrer"
                key={i}
              >
                {part}
              </a>
            );
          return <Fragment key={i}>{part}</Fragment>;
        })}
    </>
  );
}
export default function ChatText({ text }: { text: string }) {
  const lines = text.split('\n'),
    blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('|')) {
      const table: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i]
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((s) => s.trim());
        if (!cells.every((s) => /^:?-+:?$/.test(s))) table.push(cells);
        i++;
      }
      i--;
      blocks.push(
        <div className="chat-table" key={i}>
          <table>
            <tbody>
              {table.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) =>
                    r === 0 ? (
                      <th key={c}>
                        <Inline text={cell} />
                      </th>
                    ) : (
                      <td key={c}>
                        <Inline text={cell} />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else
      blocks.push(
        <span className="chat-line" key={i}>
          <Inline text={lines[i]} />
          {'\n'}
        </span>,
      );
  }
  return <>{blocks}</>;
}
