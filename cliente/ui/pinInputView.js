/**
 * Componente: pinInputView.js
 * Responsabilidade: capturar quatro dígitos sem persistir ou validar credenciais.
 * Não habilitar autenticação por PIN até existir armazenamento seguro nativo
 * (Keychain/Android Keystore) e reautenticação forte. Nunca salvar PIN no localStorage.
 */
export function createPinInput({ label = "PIN de 4 dígitos", onComplete } = {}) {
  if (typeof onComplete !== "function") throw new TypeError("A confirmação do PIN precisa de uma função válida.");
  const wrapper = document.createElement("label");
  wrapper.className = "pin-input-field";
  wrapper.textContent = label;
  const input = document.createElement("input");
  input.type = "password";
  input.inputMode = "numeric";
  input.autocomplete = "one-time-code";
  input.maxLength = 4;
  input.pattern = "[0-9]{4}";
  input.setAttribute("aria-label", label);
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 4);
    if (input.value.length === 4) onComplete(input.value);
  });
  wrapper.append(input);
  return wrapper;
}
