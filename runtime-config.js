(() => {
  // This is the only frontend API-endpoint setting. A hosting build may set
  // window.CGU_CHAT_API_URL before this file to supply a different endpoint.
  if (typeof window.CGU_CHAT_API_URL === "string" && window.CGU_CHAT_API_URL.trim()) return;

  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  window.CGU_CHAT_API_URL = isLocalHost
    ? "http://127.0.0.1:5088/api/chat"
    : "https://chatbot-api-a5ckbtdubzccdfdt.eastasia-01.azurewebsites.net/api/chat";
})();
