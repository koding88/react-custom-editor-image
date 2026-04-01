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
import macbookContainer from "./assets/macbook-container.png";

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
      <div className="mx-auto grid min-h-screen max-w-[1880px] grid-cols-1 gap-8 px-4 py-6 xl:px-8 2xl:max-w-[1980px] 2xl:px-10 lg:grid-cols-[minmax(0,1.12fr)_minmax(560px,1fr)]">
        <section className="rounded-[32px] border border-white/70 bg-white/82 p-5 shadow-[0_28px_90px_rgba(15,23,42,0.10)] backdrop-blur xl:p-7">
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

          <div className="mb-5 rounded-[26px] border border-slate-200 bg-slate-50/80 p-4 md:p-5">
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

          <div className="rounded-[28px] border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-inner shadow-slate-200/60 sm:p-4 lg:p-5">
            <div ref={holderRef} className="editor-canvas min-h-96" />
          </div>
        </section>

        <section className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:self-start">
          <div className="flex h-full min-h-0 flex-col pt-2">
            <div className="relative mx-auto flex w-full max-w-[1120px] min-h-0 flex-col items-center">
              <div className="relative w-full max-h-[calc(100vh-5rem)]">
                <img
                  src={macbookContainer}
                  alt="MacBook preview frame"
                  className="pointer-events-none block h-auto w-full select-none"
                />

                <div className="macbook-preview-screen absolute bg-black">
                  <div className="macbook-browser-shell flex h-full flex-col overflow-hidden bg-white text-slate-900">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-[#f5f5f7] px-[clamp(12px,1.1vw,18px)] py-[clamp(8px,0.9vw,12px)]">
                      <div className="flex items-center gap-[clamp(10px,1vw,16px)] text-[#2f7cff]">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-[clamp(14px,1.1vw,18px)] w-[clamp(14px,1.1vw,18px)]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M15 18l-6-6 6-6" />
                        </svg>
                        <svg
                          viewBox="0 0 24 24"
                          className="h-[clamp(14px,1.1vw,18px)] w-[clamp(14px,1.1vw,18px)] text-slate-300"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                        <svg
                          viewBox="0 0 24 24"
                          className="h-[clamp(14px,1.1vw,18px)] w-[clamp(14px,1.1vw,18px)]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M20 11a8 8 0 10-2.35 5.65" />
                          <path d="M20 4v7h-7" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-[0_1_40%] rounded-[clamp(10px,1vw,14px)] bg-[#e7e7ea] px-[clamp(10px,1vw,16px)] py-[clamp(6px,0.75vw,10px)] text-center text-[clamp(10px,0.9vw,13px)] font-medium text-slate-700">
                        blog-preview.local
                      </div>
                      <div className="flex items-center gap-[clamp(10px,1vw,16px)] text-[#2f7cff]">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-[clamp(14px,1.1vw,18px)] w-[clamp(14px,1.1vw,18px)]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M8.75 10.25L12 7l3.25 3.25" />
                          <path d="M9.5 9.75v6h5v-6" />
                        </svg>
                        <svg
                          viewBox="0 0 24 24"
                          className="h-[clamp(15px,1.15vw,19px)] w-[clamp(15px,1.15vw,19px)]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 5v14" />
                          <path d="M5 12h14" />
                        </svg>
                        <svg
                          viewBox="0 0 24 24"
                          className="h-[clamp(15px,1.15vw,19px)] w-[clamp(15px,1.15vw,19px)]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" />
                        </svg>
                      </div>
                    </div>

                    <div className="macbook-preview-scroll min-h-0 flex-1 overflow-y-auto bg-white">
                      <div className="border-b border-slate-200 bg-white px-[clamp(16px,2vw,30px)] py-[clamp(10px,1.2vw,16px)]">
                        <div className="h-[3px] w-[clamp(36px,4vw,52px)] rounded-full bg-slate-900" />
                      </div>

                      <article className="mx-auto w-full max-w-[920px] px-[clamp(18px,2.4vw,44px)] py-[clamp(22px,2.8vw,48px)]">
                        <PreviewBlocks
                          content={content}
                          renderMediaLayout={(data, blockId) => (
                            <div key={blockId} className="not-prose my-8">
                              <PreviewMedia media={data.items} layout={data.layout} />
                            </div>
                          )}
                        />
                      </article>
                    </div>
                  </div>
                </div>
              </div>
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
