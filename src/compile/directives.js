import Watcher from '../watcher'
import parser from './parser'
import IF from './if'
import FOR from './for'
import getVal, {setVal} from '../value'

// 指令解析 初始化
const tagRE = /\{\{((?:.|\n)+?)\}\}/g
const dirs = {
  text (node, vm) {
    const rawCnt = node.textContent
    let match, index, lastIndex
    let exp
    tagRE.lastIndex = lastIndex = 0
    while ((match = tagRE.exec(rawCnt))) {
      index = match.index
      if (index >= lastIndex) {
        exp = match[1].trim()
      }
      lastIndex = index + match[0].length
      link(node, vm, exp, 'text')
    }
  },

  // if 指令初始化，生成对应的 Watcher 实例
  n_if (node, vm, exp) {
    const cif = new IF(node, vm)
    cif.update(getter(vm, exp))
    new Watcher(vm, exp, () => cif.update(getter(vm, exp)))
  },

  // for 指令初始化，生成对应的 Watcher 实例
  n_for (node, vm, exp) {
    const cfor = new FOR(node, vm)
    const [keyExp, listExp] = exp.split(/ in /).map(item => item.trim())
    const dataKeys = /\((\w+),\s?(\w+)\)/g.test(keyExp) ? [RegExp.$1, RegExp.$2] : [keyExp || 'item', 'index']

    cfor.update(getter(vm, listExp), dataKeys)
    new Watcher(vm, listExp, () => cfor.update(getter(vm, listExp), dataKeys))
  },

  // n-model 的简单实现，表单项变化 关联到数据
  model (node, vm, exp) {
    link(node, vm, exp, 'model')
    let val = getter(vm, exp)
    node.addEventListener('input', e => {
      const newVal = e.target.value
      if (val === newVal) return
      setter(vm, exp, newVal)
      val = newVal
    })
  },

  // 样式类指令
  class (node, vm, exp) {
    const parserFn = parser('class')
    exp.replace(/{|}|'/g, '').split(/,/).forEach(item => {
      const [clazz, val] = item.split(':').map(item => item.trim())
      parserFn(node, getter(vm, val), clazz)

      val.split(/[<>&&!||]/).forEach(item => {
        const mark = item.trim()
        if (mark && /[^\d]/.test(mark)) {
          new Watcher(vm, mark, () => {
            parserFn(node, getter(vm, val), clazz)
          })
        }
      })
    })
  }
}

// 链接到指令解析器
const link = (node, vm, exp, dir) => {
  const parserFn = parser(dir)
  const value = getter(vm, exp)
  if (node.nodeType === Element.ELEMENT_NODE) {
    node._originalDisplay = node.style.display
  }

  parserFn(node, value, {exp, dir})
  new Watcher(vm, exp, (newVal, oldVal) => parserFn(node, newVal, {exp, oldVal}))
}

const getter = (vm, exp) => (getVal(exp))(vm)
const setter = (vm, exp, newVal) => (setVal(exp))(vm, newVal)

/**
 * 普通指令数据绑定
 * @param {*} dir 指令
 * @param {*} node 模板DOM结点
 * @param {*} vm VM实例
 * @param {*} exp 表达式
 */
const bind = (dir, node, vm, exp) => {
  if (dirs[dir]) {
    dirs[dir](node, vm, exp)
  } else {
    link(node, vm, exp, dir)
  }
}

/**
 * 事件指令绑定
 */
const eventBind = (dir, node, vm, exp) => {
  let name = exp, args = []
  if (/^(\w+)(\((.*)\))?$/.test(exp)) {
    name = RegExp.$1
    if (RegExp.$3) {
      args = RegExp.$3.split(/,/).map(item => item = vm.data[item.trim()])
    }
  }
  let eventType = dir, fn = vm.listener[name]
  
  if (eventType) {
    if (!fn) {
      fn = new Function('this.' + exp)
    }
    node.addEventListener(eventType, fn.bind(vm, ...args), false)
  }
}

export default {
  bind,
  eventBind
}
