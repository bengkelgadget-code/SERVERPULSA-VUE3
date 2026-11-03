import tailwindPostcss from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

const unwrapLayersPlugin = () => ({
  postcssPlugin: 'postcss-unwrap-layers',
  AtRule: {
    layer(atRule) {
      if (atRule.nodes) {
        atRule.replaceWith(atRule.nodes)
      } else {
        atRule.remove()
      }
    },
    property(atRule) {
      atRule.remove()
    }
  }
})
unwrapLayersPlugin.postcss = true

export default {
  plugins: [
    tailwindPostcss(),
    autoprefixer(),
    unwrapLayersPlugin()
  ]
}
