import { useEffect, useMemo, useRef, useState } from "react";
import EditorJS, { type OutputData } from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import MediaLayoutTool from "./components/editor/MediaLayoutBlockTool";
import "./components/editor/media-layout-tool.css";
import { PreviewBlocks } from "./components/preview/PreviewBlocks";
import { PreviewMedia } from "./components/preview/PreviewMedia";
import { initialContent } from "./lib/constants";
import { clearPersistedState, loadPersistedState, persistState } from "./lib/storage";
import type { PersistedState } from "./types/blog";

const safelyDestroyEditor = (instance: EditorJS | null) => {
  if (!instance) {
    return;
  }

  const maybeDestroy = instance.destroy;
  if (typeof maybeDestroy !== "function") {
    return;
  }

  try {
    maybeDestroy.call(instance);
  } catch {
    // EditorJS can already be torn down or be in an incomplete init state.
  }
};

function App() {
  const persisted = useMemo(() => loadPersistedState(), []);
  const initialEditorData = persisted?.content ?? initialContent;
  const editorRef = useRef<EditorJS | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [content, setContent] = useState<OutputData>(initialEditorData);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [submitPreviewOpen, setSubmitPreviewOpen] = useState(false);
  const [submitPayload, setSubmitPayload] = useState<string>("");

  useEffect(() => {
    if (!holderRef.current) {
      return;
    }

    let detached = false;
    let activeEditor: EditorJS | null = null;

    const createEditor = (data: OutputData) => {
      holderRef.current!.innerHTML = "";
      return new EditorJS({
        holder: holderRef.current!,
        data,
        autofocus: true,
        tools: {
          header: Header as unknown as EditorJS.ToolConstructable,
          list: List as unknown as EditorJS.ToolConstructable,
          mediaLayout: {
            class: MediaLayoutTool as unknown as EditorJS.ToolConstructable,
          },
        },
        onChange: async () => {
          if (!activeEditor) return;
          const nextData = await activeEditor.save();
          setContent(nextData);
        },
      });
    };

    const mountEditor = async (data: OutputData, allowRecovery: boolean) => {
      try {
        const editor = createEditor(data);
        activeEditor = editor;
        await editor.isReady;
        if (detached) {
          safelyDestroyEditor(editor);
          return;
        }
        setEditorError(null);
        editorRef.current = editor;
      } catch {
        safelyDestroyEditor(activeEditor);
        activeEditor = null;
        editorRef.current = null;

        if (allowRecovery) {
          clearPersistedState();
          setContent(initialContent);
          await mountEditor(initialContent, false);
          return;
        }

        queueMicrotask(() => {
          setEditorError("Khoi tao editor that bai. Anh thu tai lai trang nhe.");
        });
      }
    };

    void mountEditor(initialEditorData, true);

    return () => {
      detached = true;
      safelyDestroyEditor(activeEditor);
      editorRef.current = null;
    };
  }, [initialEditorData]);

  useEffect(() => {
    const snapshot: PersistedState = {
      content,
    };

    const warning = persistState(snapshot);
    if (warning) {
      console.warn(warning);
    }
  }, [content]);

  const handleSubmitPreview = async () => {
    const liveContent = editorRef.current ? await editorRef.current.save() : content;
    setContent(liveContent);
    setSubmitPayload(
      JSON.stringify(
        {
          content: liveContent,
        },
        null,
        2,
      ),
    );
    setSubmitPreviewOpen(true);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_24%),linear-gradient(180deg,#fffdf8_0%,#eef4ff_100%)] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] lg:px-6">
        <section className="rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur xl:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-600">
                Editor Workspace
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Blog Content Builder
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Soan noi dung, sap xep media grid va xem truoc payload gui len
                backend ngay trong giao dien nay.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSubmitPreview()}
              className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-orange-600"
            >
              Submit
            </button>
          </div>

          <div className="mb-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Chi soan phan noi dung
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Tieu de da duoc loai bo khoi form. Editor se tu phuc hoi neu draft
              local cu bi loi va khong can nut reset nua.
            </p>
          </div>

          {editorError ? (
            <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {editorError}
            </p>
          ) : null}

          <div className="rounded-[24px] border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-inner shadow-slate-200/60 sm:p-4">
            <div ref={holderRef} className="min-h-96" />
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200/80 bg-slate-950 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:p-4 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:self-start">
          <div className="flex h-full flex-col overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_28%,#f8fafc_100%)]">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
                Live Preview
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Preview nay giu dung thu tu block va hien thi media theo layout
                tinh, khong con de len noi dung phia sau.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6 sm:py-6">
              <article className="mx-auto max-w-4xl rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
                <PreviewBlocks
                  content={content}
                  renderMediaLayout={(data, blockId) => (
                    <div key={blockId} className="not-prose my-6">
                      <PreviewMedia media={data.items} layout={data.layout} />
                    </div>
                  )}
                />
              </article>
            </div>
          </div>
        </section>
      </div>

      {submitPreviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[28px] border border-white/70 bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.28)] sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-600">
                  Submit Payload
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Body gui len backend
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Payload nay chi gom du lieu editor, khong kem tieu de hay
                  metadata khac.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubmitPreviewOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-2xl leading-none text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                ×
              </button>
            </div>

            <pre className="max-h-[65vh] overflow-auto rounded-[24px] bg-slate-950 p-4 text-sm leading-7 text-slate-100">
              <code>{submitPayload}</code>
            </pre>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
