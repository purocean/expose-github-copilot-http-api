import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const express = require('express');
  const app = express();
  app.use(express.json());
  const port = 3223;

  const copilot = vscode.extensions.getExtension('github.copilot');

  let inputContent = '';

  app.post('/calculateInlineCompletions', async (req: any, res: any) => {
    if (!copilot?.isActive || !copilot.exports || !copilot.exports.calculateInlineCompletions) {
      res.status(500);
      res.send({message: 'Copilot is not active or not be hacked'});
      return;
    }

    const { content, language, line, column, triggerKind } = req.body || {};

    if (!content || !language || typeof line !== 'number' || typeof column !== 'number') {
      res.status(400);
      res.send({message: 'Missing required parameters: content, language, line, column'});
      return;
    }

    inputContent = content;

    const api = copilot.exports;

    const uri = vscode.Uri.parse('expose-github-copilot-http-api:tmp-file-' + Date.now());
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.languages.setTextDocumentLanguage(document, language);
    const position = new vscode.Position(line, column);
    const cancellation = new vscode.CancellationTokenSource();
    const completionContext = {
      triggerKind: triggerKind ?? vscode.InlineCompletionTriggerKind.Automatic,
    };

    const completions = await api.calculateInlineCompletions(
      api.ctx,
      document,
      position,
      completionContext,
      cancellation.token
    );

    if (completions && completions.type === 'success') {
      const items = completions.value.map(({ telemetry, command, ...rest }: any) => rest);
      res.send({ type: 'success', items });
    } else {
      res.send(completions);
    }
  });

  app.listen(port, () => {
    console.log(`App listening on port ${port}`);
  });

  const myProvider = new (class implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): string {
      return inputContent;
    }
  })();

  vscode.workspace.onDidCloseTextDocument((e) => {
    console.log("onDidCloseTextDocument", e.uri.toString());
  });


  vscode.workspace.registerTextDocumentContentProvider('expose-github-copilot-http-api', myProvider);
}
