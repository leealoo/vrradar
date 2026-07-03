"use client";

import { Save } from "lucide-react";
import { useEffect, useState } from "react";

type SettingsPayload = {
  dataDir: string;
  defaultDataDir: string;
  deepseekApiKey: string;
  restartRequired: boolean;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data === "object" && data && "error" in data ? String(data.error) : `请求失败：${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export default function SettingsPage() {
  const [dataDir, setDataDir] = useState("");
  const [defaultDataDir, setDefaultDataDir] = useState("");
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [status, setStatus] = useState("");
  const [restartRequired, setRestartRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await readJson<SettingsPayload>(res);
      setDataDir(data.dataDir);
      setDefaultDataDir(data.defaultDataDir);
      setDeepseekApiKey(data.deepseekApiKey || "");
      setRestartRequired(data.restartRequired);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataDir, deepseekApiKey })
      });
      const data = await readJson<SettingsPayload>(res);
      setRestartRequired(Boolean(data.restartRequired));
      setStatus("已保存");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="page-title">设置</h2>
          <p className="page-desc">配置数据目录和 API 密钥。</p>
        </div>
      </div>
      <section className="panel stack">
        <label>
          <strong>数据目录</strong>
          <input className="field" value={dataDir} onChange={(event) => setDataDir(event.target.value)} placeholder="例如 C:\Users\you\VRRadarData" />
        </label>
        <label>
          <strong>DeepSeek API 密钥</strong>
          <input className="field" type="password" value={deepseekApiKey} onChange={(event) => setDeepseekApiKey(event.target.value)} placeholder="sk-..." />
        </label>
        {defaultDataDir ? <p className="status">默认目录: {defaultDataDir}</p> : null}
        {restartRequired ? <p className="status">需要重启应用才能生效。</p> : null}
        <div>
          <button className="button" onClick={save} disabled={loading}>
            <Save size={16} />
            保存
          </button>
        </div>
        {status ? <p className="status">{status}</p> : null}
      </section>
    </>
  );
}
