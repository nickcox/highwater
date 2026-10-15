//! Width and height of an encoded image, read from its header without decoding the image.
//! Only as much of the base64 text as the header needs is decoded.

/// `(width, height)` in pixels of base64-encoded PNG, GIF, WebP or JPEG data, or `None` when
/// the data is not one of those formats or its header is incomplete.
pub(crate) fn dimensions(encoded: &str) -> Option<(u32, u32)> {
    let encoded = encoded.as_bytes();
    // A JPEG's size can follow metadata of any length; the other formats state it first.
    let mut prefix = 4096;
    loop {
        let bytes = decode_prefix(encoded, prefix);
        if let Some(found) = header_dimensions(&bytes) {
            return Some(found);
        }
        if prefix >= encoded.len() || !bytes.starts_with(&[0xFF, 0xD8]) {
            return None;
        }
        prefix = prefix.saturating_mul(8);
    }
}

/// Decodes the first `limit` characters (rounded down to whole groups of four) of standard
/// base64, stopping at padding or at the first character outside the alphabet.
fn decode_prefix(encoded: &[u8], limit: usize) -> Vec<u8> {
    let value = |byte: u8| match byte {
        b'A'..=b'Z' => Some(byte - b'A'),
        b'a'..=b'z' => Some(byte - b'a' + 26),
        b'0'..=b'9' => Some(byte - b'0' + 52),
        b'+' | b'-' => Some(62),
        b'/' | b'_' => Some(63),
        _ => None,
    };
    let end = limit.min(encoded.len()) / 4 * 4;
    let mut out = Vec::with_capacity(end / 4 * 3);
    for group in encoded[..end].as_chunks::<4>().0 {
        let mut accumulator = 0_u32;
        let mut count = 0;
        for byte in group {
            let Some(digit) = value(*byte) else { break };
            accumulator = (accumulator << 6) | u32::from(digit);
            count += 1;
        }
        let bytes = accumulator << (6 * (4 - count));
        let produced = match count {
            4 => 3,
            3 => 2,
            2 => 1,
            _ => 0,
        };
        out.extend_from_slice(&bytes.to_be_bytes()[1..1 + produced]);
        if count < 4 {
            break;
        }
    }
    out
}

fn header_dimensions(bytes: &[u8]) -> Option<(u32, u32)> {
    let u16_be = |at: usize| Some(u16::from_be_bytes(bytes.get(at..at + 2)?.try_into().ok()?));
    let u32_be = |at: usize| Some(u32::from_be_bytes(bytes.get(at..at + 4)?.try_into().ok()?));
    let u16_le = |at: usize| Some(u16::from_le_bytes(bytes.get(at..at + 2)?.try_into().ok()?));
    let u24_le = |at: usize| {
        let raw = bytes.get(at..at + 3)?;
        Some(u32::from(raw[0]) | u32::from(raw[1]) << 8 | u32::from(raw[2]) << 16)
    };
    let found = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        (u32_be(16)?, u32_be(20)?)
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        (u32::from(u16_le(6)?), u32::from(u16_le(8)?))
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        match bytes.get(12..16)? {
            b"VP8 " => (
                u32::from(u16_le(26)? & 0x3FFF),
                u32::from(u16_le(28)? & 0x3FFF),
            ),
            b"VP8L" => {
                let bits = u32::from_le_bytes(bytes.get(21..25)?.try_into().ok()?);
                ((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)
            }
            b"VP8X" => (u24_le(24)? + 1, u24_le(27)? + 1),
            _ => return None,
        }
    } else if bytes.starts_with(&[0xFF, 0xD8]) {
        let mut at = 2;
        loop {
            if *bytes.get(at)? != 0xFF {
                return None;
            }
            let marker = *bytes.get(at + 1)?;
            match marker {
                // Fill bytes, and markers that have no length.
                0xFF => at += 1,
                0x01 | 0xD0..=0xD7 => at += 2,
                // Start of frame, other than DHT (C4), JPG (C8) and DAC (CC).
                0xC0..=0xCF if !matches!(marker, 0xC4 | 0xC8 | 0xCC) => {
                    break (u32::from(u16_be(at + 7)?), u32::from(u16_be(at + 5)?));
                }
                _ => at += 2 + usize::from(u16_be(at + 2)?),
            }
        }
    } else {
        return None;
    };
    (found.0 > 0 && found.1 > 0).then_some(found)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encode(bytes: &[u8]) -> String {
        const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut out = String::new();
        for chunk in bytes.chunks(3) {
            let mut group = [0_u8; 3];
            group[..chunk.len()].copy_from_slice(chunk);
            let value = u32::from(group[0]) << 16 | u32::from(group[1]) << 8 | u32::from(group[2]);
            for position in 0..4 {
                if position <= chunk.len() {
                    out.push(ALPHABET[(value >> (18 - 6 * position) & 63) as usize] as char);
                } else {
                    out.push('=');
                }
            }
        }
        out
    }

    #[test]
    fn decoding_matches_the_encoder_for_every_length() {
        let bytes: Vec<u8> = (0..=255).collect();
        for length in 0..40 {
            let encoded = encode(&bytes[..length]);
            assert_eq!(
                decode_prefix(encoded.as_bytes(), usize::MAX),
                &bytes[..length]
            );
        }
    }

    #[test]
    fn dimensions_are_read_from_each_format_header() {
        let mut png = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR".to_vec();
        png.extend_from_slice(&1054_u32.to_be_bytes());
        png.extend_from_slice(&2000_u32.to_be_bytes());
        png.extend_from_slice(&[8, 6, 0, 0, 0]);
        assert_eq!(dimensions(&encode(&png)), Some((1054, 2000)));

        let gif = [
            b"GIF89a".as_slice(),
            &640_u16.to_le_bytes(),
            &480_u16.to_le_bytes(),
            &[0; 4],
        ]
        .concat();
        assert_eq!(dimensions(&encode(&gif)), Some((640, 480)));

        let mut vp8x = b"RIFF\0\0\0\0WEBPVP8X\x0a\0\0\0\0\0\0\0".to_vec();
        vp8x.extend_from_slice(&[0x7F, 0x07, 0x00, 0x37, 0x04, 0x00]); // 1920 × 1080
        assert_eq!(dimensions(&encode(&vp8x)), Some((1920, 1080)));

        // A JPEG with a large metadata segment before its frame header.
        let mut jpeg = vec![0xFF, 0xD8, 0xFF, 0xE1];
        jpeg.extend_from_slice(&40_002_u16.to_be_bytes());
        jpeg.extend(std::iter::repeat_n(0, 40_000));
        jpeg.extend_from_slice(&[0xFF, 0xC0, 0x00, 0x11, 0x08]);
        jpeg.extend_from_slice(&768_u16.to_be_bytes());
        jpeg.extend_from_slice(&1366_u16.to_be_bytes());
        jpeg.extend_from_slice(&[3, 0, 0, 0, 0]);
        assert_eq!(dimensions(&encode(&jpeg)), Some((1366, 768)));
    }

    #[test]
    fn unknown_or_truncated_data_has_no_dimensions() {
        assert_eq!(dimensions(""), None);
        assert_eq!(dimensions("not an image"), None);
        assert_eq!(dimensions(&encode(b"\x89PNG\r\n\x1a\n\0\0")), None);
        assert_eq!(dimensions(&encode(&[0xFF, 0xD8, 0xFF, 0xE1, 0, 10])), None);
    }
}
