"use client";

import { diffLines } from "@/lib/diff";
import type { ChallengeFile, ReviewComment } from "@/lib/types";
import { MessageSquarePlus } from "lucide-react";

export function PrDiff({ file, comments = [], onLine, markers = [] }: { file: ChallengeFile; comments?: ReviewComment[]; onLine?: (line: number) => void; markers?: Array<{ line: number; tone: string; label: string }> }) {
  const lines = diffLines(file.baseContent, file.savedContent ?? file.headContent);
  return <div className="diff-card">
    <div className="diff-file-header"><span className="status-badge">{file.status[0].toUpperCase()}</span><strong>{file.path}</strong><span className="diff-spacer" /><span className="diff-stats">+{lines.filter((l) => l.type === "add").length} −{lines.filter((l) => l.type === "del").length}</span></div>
    <div className="diff-hunk">@@ base → proposed changes @@</div>
    <div className="code-grid">
      {lines.map((line, index) => {
        const anchor = line.newLine; const lineComments = anchor ? comments.filter((comment) => comment.file === file.path && comment.line === anchor) : [];
        return <div className="contents" key={`${index}-${line.type}`}>
          <div className={`gutter ${line.type}`}><span>{line.oldLine ?? ""}</span><button type="button" aria-label={anchor ? `Comment on line ${anchor}` : undefined} disabled={!anchor || !onLine} onClick={() => anchor && onLine?.(anchor)}>{anchor ?? ""}{anchor && onLine ? <MessageSquarePlus size={13} /> : null}</button></div>
          <pre className={`code-line ${line.type}`}><span className="change-sign">{line.type === "add" ? "+" : line.type === "del" ? "−" : " "}</span>{line.text || " "}
            {anchor && markers.filter((m) => m.line === anchor).map((marker) => <span key={marker.label} className="line-marker" style={{ background: marker.tone }} title={marker.label} />)}
          </pre>
          {lineComments.map((comment) => <div className="inline-comment" key={comment.id}><div><strong>Candidate</strong><span>{comment.state}</span></div><p>{comment.body}</p></div>)}
        </div>;
      })}
    </div>
  </div>;
}
