function token(){
  return localStorage.getItem('haveeru_access_token') || '';
}

function user(){
  try {
    return JSON.parse(localStorage.getItem('haveeru_user') || 'null');
  } catch {
    return null;
  }
}

function clearSession(){
  [
    'haveeru_access_token',
    'haveeru_refresh_token',
    'haveeru_user'
  ].forEach(k => localStorage.removeItem(k));
}

function msg(text, type = 'info'){
  const el = document.getElementById('msg');
  if (!el) return;

  el.className = 'message show ' + type;
  el.textContent = text;
}

async function login(email, password){

  if (
    !APP_CONFIG.SUPABASE_PUBLISHABLE_KEY ||
    APP_CONFIG.SUPABASE_PUBLISHABLE_KEY.includes('PASTE_')
  ){
    msg(
      'Add your Supabase Publishable Key once in assets/js/config.js.',
      'error'
    );
    return;
  }

  if (!email || !password){
    msg('Enter email and password.', 'error');
    return;
  }

  const b = document.getElementById('loginBtn');

  if (b){
    b.disabled = true;
    b.textContent = 'Signing in...';
  }

  try{

    const r = await fetch(
      APP_CONFIG.SUPABASE_URL +
      '/auth/v1/token?grant_type=password',
      {
        method: 'POST',
        headers: {
          apikey: APP_CONFIG.SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password
        })
      }
    );

    const d = await r.json();

    if (!r.ok){
      throw new Error(
        d.error_description ||
        d.msg ||
        'Login failed'
      );
    }

    localStorage.setItem(
      'haveeru_access_token',
      d.access_token
    );

    localStorage.setItem(
      'haveeru_refresh_token',
      d.refresh_token || ''
    );

    localStorage.setItem(
      'haveeru_user',
      JSON.stringify(d.user || {})
    );

    location.href = 'app.html';

  } catch(e){

    msg(e.message, 'error');

  } finally{

    if (b){
      b.disabled = false;
      b.textContent = 'Login';
    }

  }
}


/*
  Shared Supabase API function.

  IMPORTANT:
  Supabase can return an empty response for
  successful INSERT/UPDATE/DELETE requests.

  Therefore we do NOT blindly call response.json().
*/

async function api(path, opts = {}){

  const headers = Object.assign(
    {
      apikey: APP_CONFIG.SUPABASE_PUBLISHABLE_KEY,
      Authorization:
        'Bearer ' +
        (
          token() ||
          APP_CONFIG.SUPABASE_PUBLISHABLE_KEY
        )
    },
    opts.headers || {}
  );

  const r = await fetch(
    APP_CONFIG.SUPABASE_URL + path,
    {
      ...opts,
      headers
    }
  );

  if (!r.ok){

    const t = await r.text();

    throw new Error(
      t ||
      r.statusText ||
      ('Request failed: ' + r.status)
    );
  }

  const text = await r.text();

  /*
    Empty response is valid.
  */

  if (!text.trim()){
    return null;
  }

  try{
    return JSON.parse(text);
  } catch {
    return text;
  }
}


function logout(){
  clearSession();
  location.href = 'index.html';
}


async function requireLogin(){

  if (!token()){
    location.href = 'index.html';
    return false;
  }

  try{

    const r = await fetch(
      APP_CONFIG.SUPABASE_URL +
      '/auth/v1/user',
      {
        headers: {
          apikey:
            APP_CONFIG.SUPABASE_PUBLISHABLE_KEY,

          Authorization:
            'Bearer ' + token()
        }
      }
    );

    if (!r.ok){
      throw 0;
    }

    return true;

  } catch {

    clearSession();
    location.href = 'index.html';

    return false;
  }
}
