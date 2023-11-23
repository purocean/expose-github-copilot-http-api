window.registerPlugin({
  name: 'yank-note-github-copilot',
  register: ctx => {
    const extensionId = 'yank-note-github-copilot'
    const enabled = ctx.lib.vue.ref(ctx.storage.get(`${extensionId}.enabled`) || true)
    const loading = ctx.lib.vue.ref(false)

    class CompletionProvider {
      monaco = undefined
      logger = ctx.utils.getLogger(extensionId)

      constructor (monaco) {
        this.monaco = monaco
      }

      freeInlineCompletions () {
        loading.value = false
      }

      handleItemDidShow () {
        loading.value = false
      }

      async provideInlineCompletions (
        _model,
        position,
        context,
        token,
      ) {
        if (!enabled.value) {
          return { items: [] }
        }

        const content = ctx.editor.getValue()
        if (content.length > 1024 * 512 || content.length < 4) {
          return []
        }

        await ctx.utils.sleep(1500)

        return {
          items: await this.provideSuggestions(content, position, context, token)
        }
      }

      async provideSuggestions (content, position, context, token) {
        if (token.isCancellationRequested) {
          return []
        }

        token.onCancellationRequested(() => {
          loading.value = false
        })

        try {
          const headers = { 'Content-Type': 'application/json' }
          const body = JSON.stringify({
            language: 'markdown',
            content,
            triggerKind: context.triggerKind,
            line: position.lineNumber - 1,
            column: position.column - 1,
          })

          loading.value = true
          const x = await ctx.api.proxyRequest(
            'http://127.0.0.1:3223/calculateInlineCompletions',
            { headers, body: body, method: 'post' },
            true
          )

          const res = await x.json()

          if (token.isCancellationRequested) {
            return []
          }

          if (!res || res.type !== 'success' || !res.items) {
            return []
          }

          loading.value = false
          return res.items.map(x => {
            const range = new this.monaco.Range(
              x.range[0].line + 1,
              x.range[0].character + 1,
              x.range[1].line + 1,
              x.range[1].character + 1,
            )

            return {
              text: x.displayText,
              insertText: { snippet: x.insertText },
              range,
            }
          })
        } catch (error) {
          loading.value = false
          ctx.ui.useToast().show('warning', 'Github Copilot:' + (error.message || `${error}`), 5000)
          throw error
        }
      }
    }

    ctx.editor.whenEditorReady().then(({ monaco }) => {
      monaco.languages.registerInlineCompletionsProvider(
        'markdown',
        new CompletionProvider(monaco)
      )
    })


    ctx.lib.vue.watchEffect(() => {
      ctx.storage.set(`${extensionId}.enabled`, enabled.value)
    })

    ctx.lib.vue.watch(() => [enabled.value, loading.value], () => {
      ctx.statusBar.refreshMenu()
    }, { immediate: true })

    ctx.statusBar.tapMenus(menus => {
      menus[extensionId] = {
        id: extensionId,
        position: 'right',
        order: -2048,
        title: loading.value ? 'AI-Loading' : enabled.value ? 'AI-On' : 'AI-Off',
        onClick: () => {
          enabled.value = !enabled.value
        },
        list: []
      }
    })
  }
});
