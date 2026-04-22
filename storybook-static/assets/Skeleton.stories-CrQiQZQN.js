import{t as e}from"./jsx-runtime-Ds6D5m35.js";var t=e(),n={display:`block`,background:`var(--skeleton-color, rgba(0,0,0,0.08))`,borderRadius:4,animation:`skeleton-pulse 1.4s ease-in-out infinite`};function r({width:e=`100%`,height:r=16,className:i=``,style:a={}}){return(0,t.jsx)(`span`,{role:`presentation`,"aria-hidden":`true`,className:i,style:{...n,width:e,height:r,...a}})}function i({size:e=36,className:r=``,style:i={}}){return(0,t.jsx)(`span`,{role:`presentation`,"aria-hidden":`true`,className:r,style:{...n,width:e,height:e,borderRadius:`50%`,flexShrink:0,...i}})}function a({lines:e=1,className:n=``,lastLineWidth:i=`60%`}){return(0,t.jsx)(`div`,{className:n,"aria-hidden":`true`,children:Array.from({length:e},(n,a)=>(0,t.jsx)(r,{height:12,width:a===e-1&&e>1?i:`100%`,style:{marginBottom:a<e-1?6:0}},a))})}function o(){return(0,t.jsxs)(`div`,{className:`d-flex align-items-center gap-3 py-2 px-3 border-bottom`,role:`presentation`,"aria-hidden":`true`,children:[(0,t.jsx)(i,{size:38}),(0,t.jsxs)(`div`,{className:`flex-grow-1`,children:[(0,t.jsx)(r,{height:13,width:`55%`,style:{marginBottom:6}}),(0,t.jsx)(r,{height:11,width:`35%`})]}),(0,t.jsx)(r,{height:11,width:50})]})}function s({lines:e=2,height:n,className:i=``}){return(0,t.jsx)(`div`,{className:`panel panel-icon ${i}`,"aria-hidden":`true`,role:`presentation`,children:(0,t.jsx)(`div`,{className:`panel-container`,children:(0,t.jsx)(`div`,{className:`panel-content`,children:n?(0,t.jsx)(r,{height:n}):(0,t.jsx)(a,{lines:e})})})})}r.__docgenInfo={description:``,methods:[],displayName:`SkeletonRect`,props:{width:{defaultValue:{value:`'100%'`,computed:!1},required:!1},height:{defaultValue:{value:`16`,computed:!1},required:!1},className:{defaultValue:{value:`''`,computed:!1},required:!1},style:{defaultValue:{value:`{}`,computed:!1},required:!1}}},i.__docgenInfo={description:``,methods:[],displayName:`SkeletonCircle`,props:{size:{defaultValue:{value:`36`,computed:!1},required:!1},className:{defaultValue:{value:`''`,computed:!1},required:!1},style:{defaultValue:{value:`{}`,computed:!1},required:!1}}},a.__docgenInfo={description:``,methods:[],displayName:`SkeletonText`,props:{lines:{defaultValue:{value:`1`,computed:!1},required:!1},className:{defaultValue:{value:`''`,computed:!1},required:!1},lastLineWidth:{defaultValue:{value:`'60%'`,computed:!1},required:!1}}},o.__docgenInfo={description:``,methods:[],displayName:`SkeletonPlantCard`},s.__docgenInfo={description:``,methods:[],displayName:`SkeletonCard`,props:{lines:{defaultValue:{value:`2`,computed:!1},required:!1},className:{defaultValue:{value:`''`,computed:!1},required:!1}}};var c={title:`Primitives/Skeleton`,tags:[`autodocs`],parameters:{layout:`padded`,docs:{description:{component:'Skeleton loaders for use while data is being fetched. All components are `aria-hidden="true"` and carry `role="presentation"` so they are invisible to screen readers.'}}}},l={name:`SkeletonRect`,render:()=>(0,t.jsxs)(`div`,{className:`d-flex flex-column gap-2`,style:{maxWidth:400},children:[(0,t.jsx)(r,{height:16}),(0,t.jsx)(r,{height:12,width:`70%`}),(0,t.jsx)(r,{height:12,width:`50%`})]})},u={name:`SkeletonCircle`,render:()=>(0,t.jsxs)(`div`,{className:`d-flex gap-3 align-items-center`,children:[(0,t.jsx)(i,{size:24}),(0,t.jsx)(i,{size:36}),(0,t.jsx)(i,{size:48}),(0,t.jsx)(i,{size:64})]})},d={name:`SkeletonText`,render:()=>(0,t.jsxs)(`div`,{className:`d-flex flex-column gap-3`,style:{maxWidth:400},children:[(0,t.jsx)(a,{lines:1}),(0,t.jsx)(a,{lines:2}),(0,t.jsx)(a,{lines:3,lastLineWidth:`40%`})]})},f={name:`SkeletonPlantCard`,render:()=>(0,t.jsxs)(`div`,{style:{maxWidth:380,border:`1px solid var(--bs-border-color)`,borderRadius:8},children:[(0,t.jsx)(o,{}),(0,t.jsx)(o,{}),(0,t.jsx)(o,{}),(0,t.jsx)(o,{})]})},p={name:`SkeletonCard`,render:()=>(0,t.jsxs)(`div`,{style:{maxWidth:440},children:[(0,t.jsx)(s,{lines:3}),(0,t.jsx)(s,{height:200,className:`mt-3`})]})};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: 'SkeletonRect',
  render: () => <div className="d-flex flex-column gap-2" style={{
    maxWidth: 400
  }}>
      <SkeletonRect height={16} />
      <SkeletonRect height={12} width="70%" />
      <SkeletonRect height={12} width="50%" />
    </div>
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: 'SkeletonCircle',
  render: () => <div className="d-flex gap-3 align-items-center">
      <SkeletonCircle size={24} />
      <SkeletonCircle size={36} />
      <SkeletonCircle size={48} />
      <SkeletonCircle size={64} />
    </div>
}`,...u.parameters?.docs?.source}}},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  name: 'SkeletonText',
  render: () => <div className="d-flex flex-column gap-3" style={{
    maxWidth: 400
  }}>
      <SkeletonText lines={1} />
      <SkeletonText lines={2} />
      <SkeletonText lines={3} lastLineWidth="40%" />
    </div>
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  name: 'SkeletonPlantCard',
  render: () => <div style={{
    maxWidth: 380,
    border: '1px solid var(--bs-border-color)',
    borderRadius: 8
  }}>
      <SkeletonPlantCard />
      <SkeletonPlantCard />
      <SkeletonPlantCard />
      <SkeletonPlantCard />
    </div>
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  name: 'SkeletonCard',
  render: () => <div style={{
    maxWidth: 440
  }}>
      <SkeletonCard lines={3} />
      <SkeletonCard height={200} className="mt-3" />
    </div>
}`,...p.parameters?.docs?.source}}};var m=[`Rect`,`Circle`,`Text`,`PlantCard`,`Card`];export{p as Card,u as Circle,f as PlantCard,l as Rect,d as Text,m as __namedExportsOrder,c as default};