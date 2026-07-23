import "katex/dist/katex.min.css";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Mathematics } from "@tiptap/extension-mathematics";
import { useEffect, useState } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter,
  AlignRight, List, ListOrdered, Heading1, Heading2, Heading3,
  Sigma, Pilcrow, Superscript as SuperscriptIcon, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Toolbar Button ─────────────────────────────────────────────────────────── */
function ToolBtn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean;
  title?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded text-sm transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-accent text-foreground",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

/* ── Math Insert Dialog ─────────────────────────────────────────────────────── */
function MathDialog({
  open, onClose, onInsert,
}: {
  open: boolean; onClose: () => void; onInsert: (latex: string, block: boolean) => void;
}) {
  const [latex, setLatex] = useState("");
  const [block, setBlock] = useState(false);

  useEffect(() => { if (open) { setLatex(""); setBlock(false); } }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-background rounded-xl shadow-xl border p-5 w-full max-w-sm space-y-4">
        <div className="font-semibold text-sm">Sisipkan Rumus Matematika</div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">LaTeX (contoh: <code>\frac{"{"}"x{"}"}{"{"}"y{"}"}</code>, <code>x^2 + y^2</code>)</label>
          <input
            autoFocus
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && latex.trim()) { onInsert(latex.trim(), block); onClose(); }
              if (e.key === "Escape") onClose();
            }}
            className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring bg-background"
            placeholder="\frac{a}{b}, \sqrt{x}, x^2"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="math-block"
            type="checkbox"
            checked={block}
            onChange={(e) => setBlock(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="math-block" className="text-xs">Tampilkan sebagai blok (baris tersendiri)</label>
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border hover:bg-accent">Batal</button>
          <button type="button" disabled={!latex.trim()} onClick={() => { onInsert(latex.trim(), block); onClose(); }}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-40">
            Sisipkan
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */
interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function RichEditor({ value, onChange, placeholder, minHeight = 240 }: RichEditorProps) {
  const [mathOpen, setMathOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Mathematics.configure({ katexOptions: { throwOnError: false } }),
    ],
    content: value || "",
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none px-3 py-2",
        "data-placeholder": placeholder ?? "",
      },
    },
  });

  // Sync external value changes (e.g. when dialog reopens with new content)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value === "" ? value : null, editor]);

  function insertMath(latex: string, block: boolean) {
    if (!editor) return;
    if (block) {
      editor.chain().focus().insertContent(`<p>$$${latex}$$</p>`).run();
    } else {
      editor.chain().focus().insertContent(`$${latex}$`).run();
    }
  }

  if (!editor) return null;

  const tb = editor; // shorthand

  return (
    <>
      <MathDialog open={mathOpen} onClose={() => setMathOpen(false)} onInsert={insertMath} />
      <div className="border rounded-md overflow-hidden bg-background">
        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/40 select-none">
          {/* Text style */}
          <ToolBtn onClick={() => tb.chain().focus().toggleBold().run()} active={tb.isActive("bold")} title="Bold (Ctrl+B)">
            <Bold className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => tb.chain().focus().toggleItalic().run()} active={tb.isActive("italic")} title="Italic (Ctrl+I)">
            <Italic className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => tb.chain().focus().toggleUnderline().run()} active={tb.isActive("underline")} title="Underline (Ctrl+U)">
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolBtn>

          <Divider />

          {/* Headings / paragraph */}
          <ToolBtn onClick={() => tb.chain().focus().setParagraph().run()} active={tb.isActive("paragraph")} title="Paragraf normal">
            <Pilcrow className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => tb.chain().focus().toggleHeading({ level: 1 }).run()} active={tb.isActive("heading", { level: 1 })} title="Judul 1">
            <Heading1 className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => tb.chain().focus().toggleHeading({ level: 2 }).run()} active={tb.isActive("heading", { level: 2 })} title="Judul 2">
            <Heading2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => tb.chain().focus().toggleHeading({ level: 3 }).run()} active={tb.isActive("heading", { level: 3 })} title="Judul 3">
            <Heading3 className="h-3.5 w-3.5" />
          </ToolBtn>

          <Divider />

          {/* Lists */}
          <ToolBtn onClick={() => tb.chain().focus().toggleBulletList().run()} active={tb.isActive("bulletList")} title="Daftar poin">
            <List className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => tb.chain().focus().toggleOrderedList().run()} active={tb.isActive("orderedList")} title="Daftar angka">
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolBtn>

          <Divider />

          {/* Alignment */}
          <ToolBtn onClick={() => tb.chain().focus().setTextAlign("left").run()} active={tb.isActive({ textAlign: "left" })} title="Rata kiri">
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => tb.chain().focus().setTextAlign("center").run()} active={tb.isActive({ textAlign: "center" })} title="Tengah">
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => tb.chain().focus().setTextAlign("right").run()} active={tb.isActive({ textAlign: "right" })} title="Rata kanan">
            <AlignRight className="h-3.5 w-3.5" />
          </ToolBtn>

          <Divider />

          {/* Horizontal rule */}
          <ToolBtn onClick={() => tb.chain().focus().setHorizontalRule().run()} title="Garis pemisah">
            <Minus className="h-3.5 w-3.5" />
          </ToolBtn>

          <Divider />

          {/* Math */}
          <ToolBtn onClick={() => setMathOpen(true)} title="Sisipkan rumus matematika (LaTeX/KaTeX)">
            <Sigma className="h-3.5 w-3.5" />
          </ToolBtn>
          <span className="text-[10px] text-muted-foreground ml-0.5 hidden sm:inline">Rumus</span>
        </div>

        {/* ── Editor area ── */}
        <EditorContent
          editor={editor}
          style={{ minHeight }}
          className={`
            [&_.ProseMirror]:min-h-[inherit]
            [&_.ProseMirror_p.is-empty::before]:content-[attr(data-placeholder)]
            [&_.ProseMirror_p.is-empty::before]:text-muted-foreground
            [&_.ProseMirror_p.is-empty::before]:float-left
            [&_.ProseMirror_p.is-empty::before]:pointer-events-none
            [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mt-4 [&_.ProseMirror_h1]:mb-2
            [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mt-3 [&_.ProseMirror_h2]:mb-1
            [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-3 [&_.ProseMirror_h3]:mb-1
            [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-5
            [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-5
            [&_.ProseMirror_hr]:border-t [&_.ProseMirror_hr]:my-3
            [&_.ProseMirror_.math-node]:inline-block [&_.ProseMirror_.math-node]:bg-blue-50 [&_.ProseMirror_.math-node]:dark:bg-blue-950 [&_.ProseMirror_.math-node]:rounded [&_.ProseMirror_.math-node]:px-1
          `}
        />

        {/* ── Help tip ── */}
        <div className="px-3 py-1 border-t bg-muted/30 text-[10px] text-muted-foreground">
          Tip: Ketik <code className="bg-muted px-0.5 rounded">$rumus$</code> untuk rumus inline, atau klik <strong>Σ</strong> untuk membuka dialog rumus.
        </div>
      </div>
    </>
  );
}
