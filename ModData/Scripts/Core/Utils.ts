export function formatStringStrict(template: string, params: any[]): string {
    return template.replace(/\{(\d+)\}/g, (_, index) =>
        params[Number(index)] !== undefined ? params[Number(index)] : "N/A"
    );
}