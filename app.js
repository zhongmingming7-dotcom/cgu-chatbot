const CHATBOT_ID = "cgu-ai-customer-service";
const APP_STATE_STORAGE_KEY = "cgu_ai_customer_service_chat_state";

let isToolPanelCollapsed = false;

const appShell = document.querySelector("#appShell");
const closeSettingsPanelButton = document.querySelector("#closeSettingsPanelButton");
const settingsToggleButton = document.querySelector("#settingsToggleButton");
const clearAllRecordsButton = document.querySelector("#clearAllRecordsButton");
const clearChatButton = document.querySelector("#clearChatButton");
const messages = document.querySelector("#messages");
const chatForm = document.querySelector("#chatForm");
const questionInput = document.querySelector("#questionInput");
const sendButton = document.querySelector("#sendButton");

init();

function init() {
  restoreAppState();
  updateToolPanelUi();
  settingsToggleButton.addEventListener("click", toggleToolPanel);
  closeSettingsPanelButton.addEventListener("click", closeToolPanel);
  clearAllRecordsButton.addEventListener("click", clearChat);
  clearChatButton.addEventListener("click", clearChat);
  questionInput.addEventListener("input", saveAppState);
  chatForm.addEventListener("submit", handleChatSubmit);

  if (!messages.children.length) {
    showMessage("您好！我可以協助查詢電腦教室與 M365 Outlook 服務。", "system", false);
  }
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const message = questionInput.value.trim();
  if (!message) return;

  showMessage(message, "user");
  questionInput.value = "";
  setSendingState(true);

  const pendingMessage = showMessage("正在查詢校務知識庫…", "assistant", false);
  pendingMessage.classList.add("streaming");

  try {
    const apiUrl = getConfiguredChatApiUrl();
    if (!apiUrl) throw new Error("客服服務端點尚未完成設定，請聯絡管理員。");
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CGU-Local-PoC": "1" },
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ chatbotId: CHATBOT_ID, message }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(getSafeErrorMessage(body, response.status));
    }

    const answer = typeof body?.answer === "string" && body.answer.trim()
      ? body.answer.trim()
      : "服務暫時沒有可顯示的回答，請稍後再試。";
    renderAnswer(pendingMessage, answer, body?.sources);
  } catch (error) {
    pendingMessage.classList.remove("assistant", "streaming");
    pendingMessage.classList.add("error");
    pendingMessage.querySelector(".message-body").textContent =
      error instanceof TypeError || error?.name === "TimeoutError"
        ? "無法連線至客服服務，請確認服務狀態後再試。"
        : error instanceof Error ? error.message : "服務暫時無法處理請求，請稍後再試。";
  } finally {
    pendingMessage.classList.remove("streaming");
    setSendingState(false);
    saveAppState();
  }
}

function getConfiguredChatApiUrl() {
  if (typeof window.CGU_CHAT_API_URL !== "string") return null;
  try {
    const endpoint = new URL(window.CGU_CHAT_API_URL.trim());
    if (endpoint.protocol === "https:") return endpoint.toString();
    return endpoint.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
      ? endpoint.toString()
      : null;
  } catch {
    return null;
  }
}

function getSafeErrorMessage(body, status) {
  if (typeof body?.message === "string" && body.message.trim()) return body.message.trim();
  if (status === 429) return "目前查詢量較高，請稍後再試。";
  return "服務暫時無法處理請求，請稍後再試。";
}

function renderAnswer(messageElement, answer, sources) {
  const body = messageElement.querySelector(".message-body");
  body.textContent = answer;
  const sourceList = Array.isArray(sources) ? sources.filter((source) => typeof source === "string" && source.trim()) : [];
  if (!sourceList.length) return;

  const sourceLabel = document.createElement("div");
  sourceLabel.className = "message-sources";
  sourceLabel.textContent = `TXT 來源：${sourceList.join("、")}`;
  body.append(sourceLabel);
}

function showMessage(text, role, shouldSave = true) {
  const message = document.createElement("article");
  message.className = `message ${role}`;
  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = text;
  message.append(body);
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
  if (shouldSave) saveAppState();
  return message;
}

function setSendingState(isSending) {
  questionInput.disabled = isSending;
  sendButton.disabled = isSending;
  if (!isSending) questionInput.focus();
}

function clearChat() {
  messages.replaceChildren();
  localStorage.removeItem(APP_STATE_STORAGE_KEY);
  showMessage("對話已清除。", "system", false);
  questionInput.value = "";
  questionInput.focus();
}

function saveAppState() {
  const savedMessages = [...messages.querySelectorAll(".message")].map((message) => ({
    role: [...message.classList].find((name) => ["user", "assistant", "system", "error"].includes(name)) || "assistant",
    text: message.querySelector(".message-body")?.childNodes[0]?.textContent || "",
    sources: message.querySelector(".message-sources")?.textContent.replace(/^TXT 來源：/, "").split("、") || [],
  }));
  localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify({ draftQuestion: questionInput.value, messages: savedMessages }));
}

function restoreAppState() {
  try {
    const state = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY) || "null");
    if (!state) return;
    questionInput.value = typeof state.draftQuestion === "string" ? state.draftQuestion : "";
    if (!Array.isArray(state.messages)) return;
    state.messages.forEach((message) => {
      if (!message?.text) return;
      const restored = showMessage(message.text, message.role || "assistant", false);
      if (message.role === "assistant" && Array.isArray(message.sources) && message.sources.length) {
        renderAnswer(restored, message.text, message.sources);
      }
    });
  } catch {
    localStorage.removeItem(APP_STATE_STORAGE_KEY);
  }
}

function toggleToolPanel() {
  isToolPanelCollapsed = !isToolPanelCollapsed;
  updateToolPanelUi();
}

function closeToolPanel() {
  isToolPanelCollapsed = true;
  updateToolPanelUi();
}

function updateToolPanelUi() {
  appShell.classList.toggle("tool-panel-collapsed", isToolPanelCollapsed);
  settingsToggleButton.textContent = isToolPanelCollapsed ? "顯示資訊" : "隱藏資訊";
  settingsToggleButton.setAttribute("aria-expanded", String(!isToolPanelCollapsed));
}
