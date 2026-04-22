import{t as e}from"./chunk-QFMPRPBF-E7ITIS5D.js";import{t}from"./jsx-runtime-Ds6D5m35.js";import{t as n}from"./Button-B9loAoSP.js";var r=t();function i({icon:t=`inbox`,title:i,description:a,actions:o=[]}){return(0,r.jsxs)(`div`,{className:`text-center py-5 px-3`,children:[(0,r.jsx)(`svg`,{className:`sa-icon sa-icon-5x text-muted mb-3`,"aria-hidden":`true`,children:(0,r.jsx)(`use`,{href:`/icons/sprite.svg#${t}`})}),(0,r.jsx)(`h5`,{className:`fw-500 mb-2`,children:i}),a&&(0,r.jsx)(`p`,{className:`text-muted mb-3`,style:{maxWidth:380,margin:`0 auto 1rem`},children:a}),o.length>0&&(0,r.jsx)(`div`,{className:`d-flex gap-2 justify-content-center flex-wrap`,children:o.map((t,i)=>t.href?(0,r.jsxs)(n,{as:e,to:t.href,variant:i===0?`primary`:`outline-secondary`,size:`sm`,children:[t.icon&&(0,r.jsx)(`svg`,{className:`sa-icon me-1`,style:{width:14,height:14},"aria-hidden":`true`,children:(0,r.jsx)(`use`,{href:`/icons/sprite.svg#${t.icon}`})}),t.label]},i):(0,r.jsxs)(n,{variant:i===0?`primary`:`outline-secondary`,size:`sm`,onClick:t.onClick,children:[t.icon&&(0,r.jsx)(`svg`,{className:`sa-icon me-1`,style:{width:14,height:14},"aria-hidden":`true`,children:(0,r.jsx)(`use`,{href:`/icons/sprite.svg#${t.icon}`})}),t.label]},i))})]})}i.__docgenInfo={description:``,methods:[],displayName:`EmptyState`,props:{icon:{defaultValue:{value:`'inbox'`,computed:!1},required:!1},actions:{defaultValue:{value:`[]`,computed:!1},required:!1}}};var a={title:`Primitives/EmptyState`,component:i,tags:[`autodocs`],parameters:{layout:`padded`},argTypes:{icon:{description:`SVG sprite icon name (from /icons/sprite.svg)`,control:`text`},title:{control:`text`},description:{control:`text`}}},o={name:`No Plants`,args:{icon:`feather`,title:`No plants yet`,description:`Add your first plant to start tracking watering schedules and care history.`,actions:[{label:`Add a plant`,icon:`plus`,onClick:()=>{}}]}},s={name:`No Search Results`,args:{icon:`search`,title:`No plants match your search`,description:`Try a different name or species.`,actions:[]}},c={name:`No Floorplan`,args:{icon:`layout`,title:`No floorplan uploaded`,description:`Upload a floorplan image to place plants on the map.`,actions:[{label:`Go to Settings`,icon:`settings`,href:`/settings`}]}},l={name:`Multiple Actions`,args:{icon:`inbox`,title:`Nothing here yet`,description:`Get started by adding content or importing from another source.`,actions:[{label:`Create new`,icon:`plus`,onClick:()=>{}},{label:`Import`,icon:`upload`,onClick:()=>{}}]}},u={name:`Title only`,args:{icon:`info`,title:`Nothing to show`,description:void 0,actions:[]}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  name: 'No Plants',
  args: {
    icon: 'feather',
    title: 'No plants yet',
    description: 'Add your first plant to start tracking watering schedules and care history.',
    actions: [{
      label: 'Add a plant',
      icon: 'plus',
      onClick: () => {}
    }]
  }
}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  name: 'No Search Results',
  args: {
    icon: 'search',
    title: 'No plants match your search',
    description: 'Try a different name or species.',
    actions: []
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  name: 'No Floorplan',
  args: {
    icon: 'layout',
    title: 'No floorplan uploaded',
    description: 'Upload a floorplan image to place plants on the map.',
    actions: [{
      label: 'Go to Settings',
      icon: 'settings',
      href: '/settings'
    }]
  }
}`,...c.parameters?.docs?.source}}},l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  name: 'Multiple Actions',
  args: {
    icon: 'inbox',
    title: 'Nothing here yet',
    description: 'Get started by adding content or importing from another source.',
    actions: [{
      label: 'Create new',
      icon: 'plus',
      onClick: () => {}
    }, {
      label: 'Import',
      icon: 'upload',
      onClick: () => {}
    }]
  }
}`,...l.parameters?.docs?.source}}},u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  name: 'Title only',
  args: {
    icon: 'info',
    title: 'Nothing to show',
    description: undefined,
    actions: []
  }
}`,...u.parameters?.docs?.source}}};var d=[`NoPlants`,`NoResults`,`NoFloor`,`MultipleActions`,`Minimal`];export{u as Minimal,l as MultipleActions,c as NoFloor,o as NoPlants,s as NoResults,d as __namedExportsOrder,a as default};