import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Image as ImageIcon, Quote, Code,
  Undo, Redo, Highlighter, Type, Code2, Upload, Loader2,
} from "lucide-react";

interface Props {
  content: string;
  onChange: (html: string) => void;
}

export default function RichTextEditor({ content, onChange }: Props) {
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlSource, setHtmlSource] = useState(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
      Placeholder.configure({ placeholder: "Börja skriva din artikel här..." }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      setHtmlSource(html);
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[200px] p-4 focus:outline-none text-foreground prose-headings:font-heading prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary",
      },
    },
  });

  // Sync content prop changes (e.g. when editing a different article)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
      setHtmlSource(content);
    }
  }, [content, editor]);

  const switchToVisual = useCallback(() => {
    if (editor) {
      editor.commands.setContent(htmlSource);
      onChange(htmlSource);
    }
    setIsHtmlMode(false);
  }, [editor, htmlSource, onChange]);

  const switchToHtml = useCallback(() => {
    if (editor) {
      setHtmlSource(editor.getHTML());
    }
    setIsHtmlMode(true);
  }, [editor]);

  const handleHtmlChange = useCallback((val: string) => {
    setHtmlSource(val);
    onChange(val);
  }, [onChange]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Ange URL:");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const addImageFromUrl = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Ange bild-URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Fel", description: "Filen måste vara en bild", variant: "destructive" });
      return;
    }
    setUploading(true);
    const path = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("kb-images").upload(path, file);
    if (error) {
      toast({ title: "Uppladdningsfel", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("kb-images").getPublicUrl(path);
    editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
    setUploading(false);
  }, [editor]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = "";
  }, [handleImageUpload]);

  if (!editor) return null;

  return (
    <div className="rounded-md border border-input bg-background overflow-hidden">
      {/* Mode toggle */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-2 py-1">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={!isHtmlMode ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => isHtmlMode && switchToVisual()}
          >
            <Type className="h-3.5 w-3.5" /> Visuell
          </Button>
          <Button
            type="button"
            variant={isHtmlMode ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => !isHtmlMode && switchToHtml()}
          >
            <Code2 className="h-3.5 w-3.5" /> HTML
          </Button>
        </div>
      </div>

      {isHtmlMode ? (
        <Textarea
          value={htmlSource}
          onChange={(e) => handleHtmlChange(e.target.value)}
          rows={12}
          className="font-mono text-xs border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[250px]"
        />
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5 bg-muted/20">
            <ToolBtn
              active={editor.isActive("heading", { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              icon={<Heading1 className="h-3.5 w-3.5" />}
              title="Rubrik 1"
            />
            <ToolBtn
              active={editor.isActive("heading", { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              icon={<Heading2 className="h-3.5 w-3.5" />}
              title="Rubrik 2"
            />
            <ToolBtn
              active={editor.isActive("heading", { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              icon={<Heading3 className="h-3.5 w-3.5" />}
              title="Rubrik 3"
            />
            <Separator orientation="vertical" className="h-5 mx-1" />
            <ToolBtn
              active={editor.isActive("bold")}
              onClick={() => editor.chain().focus().toggleBold().run()}
              icon={<Bold className="h-3.5 w-3.5" />}
              title="Fetstil"
            />
            <ToolBtn
              active={editor.isActive("italic")}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              icon={<Italic className="h-3.5 w-3.5" />}
              title="Kursiv"
            />
            <ToolBtn
              active={editor.isActive("underline")}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              icon={<UnderlineIcon className="h-3.5 w-3.5" />}
              title="Understrykning"
            />
            <ToolBtn
              active={editor.isActive("strike")}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              icon={<Strikethrough className="h-3.5 w-3.5" />}
              title="Genomstrykning"
            />
            <ToolBtn
              active={editor.isActive("highlight")}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              icon={<Highlighter className="h-3.5 w-3.5" />}
              title="Markering"
            />
            <Separator orientation="vertical" className="h-5 mx-1" />
            <ToolBtn
              active={editor.isActive("bulletList")}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              icon={<List className="h-3.5 w-3.5" />}
              title="Punktlista"
            />
            <ToolBtn
              active={editor.isActive("orderedList")}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              icon={<ListOrdered className="h-3.5 w-3.5" />}
              title="Numrerad lista"
            />
            <ToolBtn
              active={editor.isActive("blockquote")}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              icon={<Quote className="h-3.5 w-3.5" />}
              title="Citat"
            />
            <ToolBtn
              active={editor.isActive("codeBlock")}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              icon={<Code className="h-3.5 w-3.5" />}
              title="Kodblock"
            />
            <Separator orientation="vertical" className="h-5 mx-1" />
            <ToolBtn
              active={editor.isActive({ textAlign: "left" })}
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              icon={<AlignLeft className="h-3.5 w-3.5" />}
              title="Vänsterjustera"
            />
            <ToolBtn
              active={editor.isActive({ textAlign: "center" })}
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              icon={<AlignCenter className="h-3.5 w-3.5" />}
              title="Centrera"
            />
            <ToolBtn
              active={editor.isActive({ textAlign: "right" })}
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              icon={<AlignRight className="h-3.5 w-3.5" />}
              title="Högerjustera"
            />
            <Separator orientation="vertical" className="h-5 mx-1" />
            <ToolBtn
              active={editor.isActive("link")}
              onClick={addLink}
              icon={<LinkIcon className="h-3.5 w-3.5" />}
              title="Infoga länk"
            />
            <ToolBtn
              active={false}
              onClick={() => fileInputRef.current?.click()}
              icon={uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              title="Ladda upp bild"
              disabled={uploading}
            />
            <ToolBtn
              active={false}
              onClick={addImageFromUrl}
              icon={<ImageIcon className="h-3.5 w-3.5" />}
              title="Infoga bild via URL"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileChange}
            />
            <Separator orientation="vertical" className="h-5 mx-1" />
            <ToolBtn
              active={false}
              onClick={() => editor.chain().focus().undo().run()}
              icon={<Undo className="h-3.5 w-3.5" />}
              title="Ångra"
              disabled={!editor.can().undo()}
            />
            <ToolBtn
              active={false}
              onClick={() => editor.chain().focus().redo().run()}
              icon={<Redo className="h-3.5 w-3.5" />}
              title="Gör om"
              disabled={!editor.can().redo()}
            />
          </div>

          {/* Editor */}
          <EditorContent editor={editor} />
        </>
      )}
    </div>
  );
}

function ToolBtn({ active, onClick, icon, title, disabled }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
}) {
  return (
    <Toggle
      size="sm"
      pressed={active}
      onPressedChange={onClick}
      disabled={disabled}
      title={title}
      className="h-7 w-7 p-0 data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
    >
      {icon}
    </Toggle>
  );
}
