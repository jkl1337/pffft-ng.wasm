#!/usr/bin/env sh
#shellcheck disable=SC2086
set -euf

emcc -v

exported_functions_f32="_pffft_new_setup,_pffft_destroy_setup,_pffft_transform,\
_pffft_transform_ordered,_pffft_zreorder,_pffft_zconvolve_accumulate,_pffft_zconvolve_no_accu,\
_pffft_simd_size,_pffft_simd_arch,_pffft_min_fft_size,_pffft_is_valid_size,_pffft_nearest_transform_size,\
_pffft_aligned_malloc,_pffft_aligned_free"

exported_functions_f64="_pffftd_new_setup,_pffftd_destroy_setup,_pffftd_transform,\
_pffftd_transform_ordered,_pffftd_zreorder,_pffftd_zconvolve_accumulate,_pffftd_zconvolve_no_accu,\
_pffftd_simd_size,_pffftd_simd_arch,_pffftd_min_fft_size,_pffftd_is_valid_size,_pffftd_nearest_transform_size,\
_pffftd_aligned_malloc,_pffftd_aligned_free"

cflags_common="-std=c99 -Wall -Wextra -Werror -Wno-unused-parameter -O3 -flto -msimd128\
    -D_USE_MATH_DEFINES -DNDEBUG -Icompat"
ldflags_common="--no-entry -sSTRICT -sNO_ASSERTIONS -sNO_FILESYSTEM -sMALLOC=emmalloc"

runemcc() {
    echo "emcc" "$@"
    emcc "$@"
}

runemcc ${cflags_common} -msse -D_M_X64 ${ldflags_common} -sEXPORTED_FUNCTIONS="$exported_functions_f32" \
    pffft/pffft.c pffft/pffft_common.c \
    -o src/pffft-ng-f32.wasm

runemcc ${cflags_common} -mavx ${ldflags_common} -sEXPORTED_FUNCTIONS="$exported_functions_f64" \
    pffft/pffft_double.c pffft/pffft_common.c \
    -o src/pffft-ng-f64.wasm
