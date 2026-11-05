import { Client, Account, Databases, ID, Query } from "https://cdn.jsdelivr.net/npm/appwrite@14.0.1/+esm";

export const APPWRITE_ENDPOINT = "https://appwrite.r2csolucoes.com.br/v1";
export const APPWRITE_PROJECT_ID = "6aeb6430001ca1c0c0f5";
export const APPWRITE_DATABASE_ID = "6aeb6a710034d7f79aad";

export const client = new Client();
client
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export { ID, Query };

