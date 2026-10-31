import crypto from 'crypto';

/**
 * Generate AfrStar Signature
 * Concatenates values directly without separators, then hashes MD5.
 */
export function generateAfrStarSign(...parts) {
    const stringToSign = parts.join('');
    return crypto.createHash('md5').update(stringToSign).digest('hex');
}

/**
 * Verify Incoming Webhook Signature
 * @param {Object} payload - The parsed JSON body from webhook
 * @param {Array<string>} orderedFieldNames - Field names in exact signature order defined in docs
 */
export function verifyWebhookSignature(payload, orderedFieldNames) {
    const receivedSig = payload.sign?.toLowerCase();
    if (!receivedSig) return false;

    // Extract values in order specified by documentation
    const values = orderedFieldNames.map(field => String(payload[field] ?? ''));
    
    // Construct expected sign: AK + field1 + field2 ... + SK
    const ak = process.env.AFRSTAR_ACCESS_KEY;
    const sk = process.env.AFRSTAR_SECRET_KEY;
    
    const fullString = [ak, ...values, sk].join('');
    const computedSig = crypto.createHash('md5').update(fullString).digest('hex');
    
    return computedSig === receivedSig;
}
