import{t as e}from"./jsx-runtime-Ds6D5m35.js";import{t}from"./Button-B9loAoSP.js";import{t as n}from"./Alert-Dj4vUHtc.js";var r=`Try again`;function i(e){if(!e)return``;if(typeof e==`string`)return e;if(e.message)return String(e.message);try{return String(e)}catch{return``}}function a(e,t={}){let n=i(e),a=t.context||``;return(t.online??(typeof navigator>`u`?!0:navigator.onLine!==!1))===!1?{title:`You're offline`,message:`Changes you make are saved on this device and will sync automatically when you reconnect.`,action:`Retry`,kind:`offline`,isRetryable:!0,rawCode:n}:/failed to fetch|networkerror|network error|load failed|network request failed|ERR_NETWORK/i.test(n)?{title:`Couldn't reach the server`,message:`Check your connection — the internet blinked while we were talking to the server.`,action:`Retry`,kind:`transient`,isRetryable:!0,rawCode:n}:/GCS upload failed|upload failed/i.test(n)?{title:`Couldn't upload that photo`,message:`Check your connection, then try uploading the photo again.`,action:`Retry upload`,kind:`transient`,isRetryable:!0,rawCode:n}:/\b401\b|unauthenticated|unauthorized|session expired|invalid token|token expired/i.test(n)?{title:`Your session has expired`,message:`Please sign in again to keep your changes safe.`,action:`Sign in again`,kind:`auth`,isRetryable:!1,rawCode:n}:/\b403\b|permission_denied|forbidden|not allowed/i.test(n)?{title:`You don't have access`,message:a?`Your account can't ${a} right now. If you think this is a mistake, sign out and back in.`:`Your account doesn't have access to this action.`,action:`Sign in again`,kind:`permission`,isRetryable:!1,rawCode:n}:/\b429\b|rate limit|rate_limit|resource_exhausted|too many requests|quota/i.test(n)?{title:`Busy right now`,message:`The AI assistant is getting a lot of requests. Give it a few seconds and try again.`,action:`Try again`,kind:`quota`,isRetryable:!0,rawCode:n}:/overloaded|high demand|\b503\b|service unavailable/i.test(n)?{title:`The service is under heavy load`,message:`We'll be up again in a moment. Retrying usually does the trick.`,action:`Retry`,kind:`transient`,isRetryable:!0,rawCode:n}:/\b(502|504)\b|gateway|timeout|timed? ?out/i.test(n)?{title:`The server took too long`,message:`That's usually a blip — retrying normally fixes it.`,action:`Retry`,kind:`transient`,isRetryable:!0,rawCode:n}:/\b5\d\d\b|internal server error|unexpected response from server/i.test(n)?{title:`Something went wrong on our side`,message:`We've logged the error. Retrying usually works.`,action:`Retry`,kind:`transient`,isRetryable:!0,rawCode:n}:/position \d+/i.test(n)&&/object key|expected/i.test(n)?{title:`The AI gave an unexpected response`,message:`Our plant assistant got confused — please try again in a moment.`,action:`Try again`,kind:`transient`,isRetryable:!0,rawCode:n}:/\b400\b|bad request|invalid|required|must be/i.test(n)?{title:`That didn't look right`,message:n.replace(/^\s*(error|http\s*\d+:?)\s*/i,``).trim()||`The server rejected that input — please review and try again.`,action:`Review`,kind:`input`,isRetryable:!1,rawCode:n}:/\b404\b|not found/i.test(n)?{title:`We couldn't find that`,message:a?`The ${a} you were looking for no longer exists.`:`The item you were looking for no longer exists.`,action:`Go back`,kind:`input`,isRetryable:!1,rawCode:n}:{title:a?`Something went wrong with ${a}`:`Something went wrong`,message:`This is usually temporary. If it keeps happening, refresh the page or try again in a minute.`,action:r,kind:`unknown`,isRetryable:!0,rawCode:n}}var o=e(),s={offline:`wifi-off`,auth:`lock`,permission:`lock`,quota:`clock`,transient:`alert-triangle`,input:`alert-circle`,unknown:`alert-triangle`},c={offline:`warning`,auth:`warning`,permission:`warning`,quota:`info`,transient:`danger`,input:`danger`,unknown:`danger`};function l({error:e,context:r,onRetry:i,onDismiss:l,onReport:u,className:d=``,size:f}){if(!e)return null;let p=e.kind&&e.title?e:a(e,{context:r}),m=s[p.kind]||s.unknown,h=c[p.kind]||c.unknown;return(0,o.jsx)(n,{variant:h,className:`${f===`sm`?`py-2 fs-sm mb-2`:`mb-3`} ${d}`,dismissible:!!l,onClose:l,role:`alert`,children:(0,o.jsxs)(`div`,{className:`d-flex gap-2 align-items-start`,children:[(0,o.jsx)(`svg`,{className:`sa-icon flex-shrink-0 mt-1`,style:{width:18,height:18},"aria-hidden":`true`,children:(0,o.jsx)(`use`,{href:`/icons/sprite.svg#${m}`})}),(0,o.jsxs)(`div`,{className:`flex-grow-1`,children:[(0,o.jsx)(`strong`,{className:`d-block`,children:p.title}),(0,o.jsx)(`div`,{className:`fs-sm`,children:p.message}),(i||u)&&(0,o.jsxs)(`div`,{className:`d-flex gap-2 mt-2 flex-wrap`,children:[i&&p.isRetryable&&(0,o.jsx)(t,{size:`sm`,variant:h===`danger`?`outline-danger`:`outline-${h}`,onClick:i,children:p.action}),u&&p.rawCode&&(0,o.jsx)(t,{size:`sm`,variant:`link`,className:`text-muted p-0`,onClick:()=>u(p.rawCode),children:`Report this`})]})]})]})})}l.__docgenInfo={description:`Displays a \`FriendlyError\` (or raw error converted on the fly) with an
icon, recovery copy, and optional retry / secondary actions.

Props:
  - error        required. Either a FriendlyError from \`toFriendlyError()\`
                 or any raw error-like value (string / Error).
  - context      string passed through to \`toFriendlyError\` when \`error\` is raw.
  - onRetry      if provided, renders a retry button labelled from the
                 friendly action.
  - onDismiss    if provided, renders the dismiss "×" control.
  - onReport     optional "Report this" CTA; receives the rawCode string.
  - className    bootstrap alert className override.
  - size         'sm' gives denser padding for inline slots.`,methods:[],displayName:`ErrorAlert`,props:{className:{defaultValue:{value:`''`,computed:!1},required:!1}}};var u={title:`Primitives/ErrorAlert`,component:l,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:"Renders a `FriendlyError` (from `toFriendlyError()`) with an appropriate icon, colour, recovery copy, and optional retry/dismiss actions. Pass a raw `Error` or string and it will be converted automatically."}}}},d=(e,t,n,r=`Try again`)=>({kind:e,title:t,message:n,action:r,rawCode:`ERR_${e.toUpperCase()}`}),f={args:{error:d(`offline`,`You're offline`,`Check your internet connection and try again.`,`Retry`),onRetry:()=>{}}},p={args:{error:d(`transient`,`Something went wrong`,`The server returned an unexpected error. This is usually temporary.`,`Try again`),onRetry:()=>{},onDismiss:()=>{}}},m={args:{error:d(`auth`,`Session expired`,`Sign in again to continue.`,`Sign in`),onRetry:()=>{}}},h={args:{error:d(`quota`,`Rate limit reached`,`You've used all your AI analyses for this period. Upgrade to Home Pro for unlimited analyses.`,`See plans`)}},g={name:`Input validation`,args:{error:d(`input`,`Invalid input`,`Plant name must be at least 1 character.`,void 0)}},_={name:`Dismissible (no retry)`,args:{error:d(`transient`,`Could not save`,`Changes were not saved. Please try again.`),onDismiss:()=>{}}},v={name:`With "Report this" CTA`,args:{error:d(`unknown`,`Unexpected error`,`An unexpected error occurred. Please report this if it persists.`),onRetry:()=>{},onDismiss:()=>{},onReport:e=>alert(`Reporting: ${e}`)}},y={name:`Small (inline)`,args:{error:d(`input`,`Required field`,`This field cannot be empty.`),size:`sm`}},b={name:`From raw Error`,args:{error:Error(`Network request failed`),context:`loading plants`,onRetry:()=>{}}};f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    error: makeError('offline', 'You\\'re offline', 'Check your internet connection and try again.', 'Retry'),
    onRetry: () => {}
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    error: makeError('transient', 'Something went wrong', 'The server returned an unexpected error. This is usually temporary.', 'Try again'),
    onRetry: () => {},
    onDismiss: () => {}
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    error: makeError('auth', 'Session expired', 'Sign in again to continue.', 'Sign in'),
    onRetry: () => {}
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    error: makeError('quota', 'Rate limit reached', 'You\\'ve used all your AI analyses for this period. Upgrade to Home Pro for unlimited analyses.', 'See plans')
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  name: 'Input validation',
  args: {
    error: makeError('input', 'Invalid input', 'Plant name must be at least 1 character.', undefined)
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  name: 'Dismissible (no retry)',
  args: {
    error: makeError('transient', 'Could not save', 'Changes were not saved. Please try again.'),
    onDismiss: () => {}
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  name: 'With "Report this" CTA',
  args: {
    error: makeError('unknown', 'Unexpected error', 'An unexpected error occurred. Please report this if it persists.'),
    onRetry: () => {},
    onDismiss: () => {},
    onReport: code => alert(\`Reporting: \${code}\`)
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  name: 'Small (inline)',
  args: {
    error: makeError('input', 'Required field', 'This field cannot be empty.'),
    size: 'sm'
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  name: 'From raw Error',
  args: {
    error: new Error('Network request failed'),
    context: 'loading plants',
    onRetry: () => {}
  }
}`,...b.parameters?.docs?.source}}};var x=[`Offline`,`Transient`,`Auth`,`Quota`,`InputError`,`DismissOnly`,`WithReport`,`SmallSize`,`RawError`];export{m as Auth,_ as DismissOnly,g as InputError,f as Offline,h as Quota,b as RawError,y as SmallSize,p as Transient,v as WithReport,x as __namedExportsOrder,u as default};