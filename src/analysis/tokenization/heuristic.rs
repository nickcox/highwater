pub(crate) fn count(text: &str) -> u64 {
    let scalars = text.chars().count();
    if scalars == 0 {
        0
    } else {
        scalars.div_ceil(4) as u64
    }
}
