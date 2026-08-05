const form = document.getElementById("server-form");
const serverHostInput = document.getElementById("serverHost");
const connectButton = document.getElementById("connect-button");
const errorMessage = document.getElementById("error-message");

function setLoading(isLoading) {
  connectButton.disabled = isLoading;
  connectButton.classList.toggle("is-loading", isLoading);
  connectButton.querySelector("span").textContent = isLoading
    ? "Connecting..."
    : "Connect to Server";
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  setLoading(true);

  try {
    const result = await window.libreChatDesktop.submitServerHost(
      serverHostInput.value,
    );

    if (!result.ok) {
      showError(result.error || "Unable to connect to this server.");
      setLoading(false);
    }
  } catch {
    showError("Unable to save the LibreChat server URL.");
    setLoading(false);
  }
});
