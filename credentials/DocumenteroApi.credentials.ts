import type {
    IAuthenticateGeneric,
    ICredentialTestRequest,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class DocumenteroApi implements ICredentialType {
    name = 'documenteroApi';
    displayName = 'Documentero API';

    documentationUrl = 'https://app.documentero.com';

    properties: INodeProperties[] = [
        {
            displayName: 'API Key',
            name: 'apiKey',
            type: 'string',
            default: '',
            typeOptions: {
                password: true,
            },
            description: 'Get API key from your Documentero account settings <a href="https://app.documentero.com/admin/account">https://app.documentero.com/admin/account</a>',
            required: true,
        },
    ];

    authenticate: IAuthenticateGeneric = {
        type: 'generic',
        properties: {
            headers: {
                // Documentero expects the API key in the Authorization header without Bearer prefix
                Authorization: '={{ $credentials.apiKey }}',
            },
        },
    };

    test: ICredentialTestRequest = {
        request: {
            baseURL: 'https://app.documentero.com',
            url: '/templates',
            method: 'GET',
        },
    };
}
