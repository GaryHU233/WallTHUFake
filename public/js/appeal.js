/* 申诉页 */
"use strict";

initHeader("appeal");
initFooter();

const form = document.getElementById("appeal-form");
const captchaBox = document.getElementById("appeal-captcha");
const counter = document.getElementById("appeal-counter");
const result = document.getElementById("appeal-result");

captchaBox.innerHTML = captchaHtml();
bindCaptcha(captchaBox);

form.elements.content.addEventListener("input", () => {
  const n = form.elements.content.value.length;
  counter.textContent = `${n} / 1000`;
  counter.classList.toggle("over", n > 1000);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = form.elements.content.value.trim();
  const captcha = form.elements.captcha.value.trim();
  const postId = form.elements.post_id.value.trim();

  if (content.length < 5) return toast("请把情况写清楚（至少 5 个字）", "error");
  if (!captcha) return toast("请输入验证码", "error");
  if (postId && !/^\d+$/.test(postId)) return toast("帖子编号应为数字", "error");

  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = "提交中…";
  try {
    const data = await api("/api/appeals", {
      method: "POST",
      body: {
        post_id: postId || null,
        content,
        contact: form.elements.contact.value.trim(),
        captcha,
      },
    });
    toast(data.message || "申诉已提交", "success");
    result.innerHTML = `<div class="notice brand" style="margin-top:16px">
        <span>✅</span><span>申诉已提交，管理员会尽快处理。请保留帖子编号，便于后续跟进。</span>
      </div>`;
    form.reset();
    counter.textContent = "0 / 1000";
  } catch (err) {
    toast(err.message, "error");
    const img = captchaBox.querySelector("[data-captcha]");
    if (img) refreshCaptcha(img);
    form.elements.captcha.value = "";
  } finally {
    submit.disabled = false;
    submit.textContent = "提交申诉";
  }
});
