const params = new URLSearchParams(location.search);
const form = document.createElement('form');
form.action = params.get('url');
form.acceptCharset = params.get('encoding') || 'utf-8';
form.method = 'POST';
form.style.display = 'none';
const post = new URLSearchParams(params.get('post'));
[...post.entries()].forEach(([name, value]) => {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  form.appendChild(input);
});
document.body.appendChild(form);
form.submit();
