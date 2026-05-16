import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import MobileShell from "../components/MobileShell";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";

export default function CreateSolo() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!user) {
    navigate("/", { replace: true });
    return null;
  }

  const submit = async () => {
    if (!title.trim() || !file) return toast.error("Add a title and a PDF");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("mode", "solo");
      fd.append("file", file);
      const { data } = await api.post("/books", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      navigate(`/read/${data.book_id}`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell>
      <div className="px-6 pt-6 pb-24">
        <button
          onClick={() => navigate(-1)}
          className="text-[#787571] flex items-center gap-1 text-sm"
          data-testid="back-button"
        >
          <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> Back
        </button>
        <div className="mt-6 text-[10px] tracking-[0.25em] uppercase text-[#A8A5A1]">
          Solo session
        </div>
        <h1 className="font-serif text-[36px] leading-tight tracking-tight mt-2">
          What are you reading?
        </h1>
        <p className="text-[#787571] mt-2">A private space for your own pages.</p>

        <div className="mt-8 flex flex-col gap-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Book title"
            className="border-b border-[#EAE6E1] bg-transparent py-3 font-serif text-2xl focus:outline-none focus:border-[#C86A58]"
            data-testid="solo-title-input"
          />
          <label
            htmlFor="solo-pdf"
            className="mt-2 border-2 border-dashed border-[#EAE6E1] rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer bg-white hover:border-[#C86A58] transition-colors"
            data-testid="solo-pdf-upload-area"
          >
            <Upload strokeWidth={1.5} className="w-6 h-6 text-[#A8A5A1]" />
            <span className="text-sm">
              {file ? file.name : "Tap to choose a PDF"}
            </span>
            <input
              id="solo-pdf"
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              data-testid="solo-pdf-input"
            />
          </label>
          <button
            onClick={submit}
            disabled={loading}
            data-testid="solo-submit"
            className="mt-4 w-full bg-[#C86A58] hover:bg-[#B35A4A] text-white rounded-full py-4 font-medium disabled:opacity-60"
          >
            {loading ? "Preparing..." : "Start reading"}
          </button>
        </div>
      </div>
    </MobileShell>
  );
}
