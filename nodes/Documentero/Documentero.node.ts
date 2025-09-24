import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import type { IExecuteFunctions, INodeExecutionData, INodePropertyOptions, ILoadOptionsFunctions, IDataObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

export class Documentero implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Documentero',
        name: 'documentero',
        icon: { light: 'file:Documentero.svg', dark: 'file:DocumenteroWhite.svg' },
        group: ['transform'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Generate Word, Excel or PDF Document based on Document Template. Get API Key from Documentero APP',
        defaults: { name: 'Documentero' },
        inputs: [NodeConnectionType.Main],
        outputs: [NodeConnectionType.Main],
        usableAsTool: true,
        credentials: [{ name: 'documenteroApi', required: true }],
        properties: [
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                options: [
                    { name: 'Generate Document', value: 'generate', action: 'Generate document' },
                    { name: 'Generate Document and Send as Email Attachment', value: 'generateAndEmail', action: 'Generate document and send as email attachment' },
                ],
                default: 'generate',
            },
            {
                displayName: 'Document Template Name or ID',
                name: 'document',
                type: 'options',
                noDataExpression: true,
                typeOptions: {
                    loadOptionsMethod: 'loadTemplates',
                },
                required: true,
                placeholder: 'Document Template',
                default: '',
                description: 'Manage document templates in <a href="https://app.documentero.com/admin/collections">Documentero App</a>. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
            },
            {
                displayName: 'Data Source',
                name: 'dataSource',
                type: 'options',
                options: [
                    { name: 'JSON Editor', value: 'json' },
                    { name: 'From Input Item JSON', value: 'input' },
                ],
                default: 'json',
                description: 'Provide the dynamic data for the template',
            },
            {
                displayName: 'Data (JSON)',
                name: 'dataJson',
                type: 'json',
                default: '{}',
                displayOptions: { show: { dataSource: ['json'] } },
                description: 'You can copy initial JSON structure for selected template from <a href="https://app.documentero.com/admin/collections">Documentero App</a> > Template Overview > API/JSON',
            },
            // Email-only fields
            { displayName: 'Email', name: 'email', type: 'string', default: '', placeholder: 'name@email.com', displayOptions: { show: { operation: ['generateAndEmail'] } } },
            { displayName: 'Email Subject', name: 'emailSubject', type: 'string', default: '', displayOptions: { show: { operation: ['generateAndEmail'] } } },
            { displayName: 'Email Message', name: 'emailMessage', type: 'string', typeOptions: { rows: 3 }, default: '', displayOptions: { show: { operation: ['generateAndEmail'] } } },
            { displayName: 'Email Footer', name: 'emailFooter', type: 'string', default: '', displayOptions: { show: { operation: ['generateAndEmail'] } } },
            { displayName: 'Email Sender', name: 'emailSender', type: 'string', default: '', displayOptions: { show: { operation: ['generateAndEmail'] } } },
            { displayName: 'Email CC', name: 'emailCC', type: 'string', default: '', displayOptions: { show: { operation: ['generateAndEmail'] } } },
            { displayName: 'Email BCC', name: 'emailBCC', type: 'string', default: '', displayOptions: { show: { operation: ['generateAndEmail'] } } }
        ],
    };

    // Class-level methods
    methods = {
        loadOptions: {
            async loadTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                let res: any;
                try {
                    res = await this.helpers.httpRequestWithAuthentication.call(this, 'documenteroApi', {
                        method: 'GET',
                        url: 'https://app.documentero.com/api/templates',
                        qs: { types: true },
                        json: true,
                    });
                } catch (err) {
                    const msg = formatApiError(err, 'Failed to load templates');
                    // Use NodeApiError for API-related errors in n8n nodes
                    throw new NodeApiError(this.getNode(), { message: msg });
                }
                const data = (res as any)?.data ?? [];
                return (data as any[]).map((t: any) => ({ name: t.label as string, value: t.value as string }));
            },
        },
    };

    async execute(this: IExecuteFunctions) {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
    // Credentials handled via httpRequestWithAuthentication
    // No schema auto-population; users provide JSON manually

        for (let i = 0; i < items.length; i++) {
            try {
                const operation = this.getNodeParameter('operation', i) as string;
                const document = this.getNodeParameter('document', i) as string;
                const dataSource = this.getNodeParameter('dataSource', i) as string;
                let data: Record<string, any>;
                if (dataSource === 'json') {
                    data = this.getNodeParameter('dataJson', i, {}) as Record<string, any>;
                    if (typeof (data as unknown) === 'string') {
                        const raw = data as unknown as string;
                        data = raw.trim() === '' ? {} : (JSON.parse(raw) as Record<string, any>);
                    }
                } else {
                    data = items[i].json as Record<string, any>;
                }

                const body: Record<string, any> = { document, data };
                if (operation === 'generateAndEmail') {
                    body.email = this.getNodeParameter('email', i) as string;
                    body.emailSubject = this.getNodeParameter('emailSubject', i, '') as string;
                    body.emailMessage = this.getNodeParameter('emailMessage', i, '') as string;
                    body.emailFooter = this.getNodeParameter('emailFooter', i, '') as string;
                    body.emailSender = this.getNodeParameter('emailSender', i, '') as string;
                    body.emailCC = this.getNodeParameter('emailCC', i, '') as string;
                    body.emailBCC = this.getNodeParameter('emailBCC', i, '') as string;
                }

                let res: any;
                try {
                    res = await this.helpers.httpRequestWithAuthentication.call(this, 'documenteroApi', {
                        method: 'POST',
                        url: 'https://app.documentero.com/api',
                        headers: { embed: 'true' },
                        body,
                        json: true,
                    });
                } catch (err) {
                    if (this.continueOnFail()) {
                        returnData.push({
                            json: { error: formatApiError(err, 'Document generation failed') },
                            pairedItem: { item: i },
                        });
                        continue;
                    }
                    const msg = formatApiError(err, 'Document generation failed');
                    throw new NodeOperationError(this.getNode(), msg);
                }

                let item: INodeExecutionData = { json: (res as unknown) as IDataObject };
                const genData = (res as any)?.data;
                if (genData?.fileContent) {
                    const base64 = genData.fileContent as string;
                    const binaryPropertyName = 'data';
                    item.binary = item.binary ?? {};
                    const buffer = Buffer.from(base64, 'base64');
                    item.binary[binaryPropertyName] = await this.helpers.prepareBinaryData(
                        buffer,
                        (genData.fileName as string) || 'document',
                        (genData.contentType as string) || 'application/octet-stream',
                    );
                    if (item.json && (item.json as any).data) {
                        delete (item.json as any).data.fileContent;
                    }
                }
                returnData.push({
                    ...item,
                    pairedItem: { item: i },
                });
            } catch (err) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: { error: (err as Error).message },
                        pairedItem: { item: i },
                    });
                    continue;
                }
                throw err;
            }
        }

        return [returnData];
    }
}

// Helper to format API error messages consistently
function formatApiError(err: any, context: string) {
    // Try to extract an error payload from multiple possible locations
    let raw: any = err?.response?.body ?? err?.response?.data ?? err?.error ?? err?.cause?.response?.body;
    let body: any = undefined;
    if (raw !== undefined) {
        try {
            if (typeof raw === 'string') {
                try {
                    body = JSON.parse(raw);
                } catch {
                    body = { message: raw };
                }
            } else if (typeof raw === 'object') {
                body = raw;
            }
        } catch {
            // ignore parse issues; fall back to generic error fields
        }
    }

    const status = body?.status ?? err?.statusCode ?? err?.response?.statusCode;
    const message = body?.message ?? err?.message ?? 'Request failed';
    const suffix = status ? ` (status ${status})` : '';
    return `${context}: ${message}${suffix}`;
}