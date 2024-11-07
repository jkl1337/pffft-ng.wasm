cmake_minimum_required(VERSION 3.20)
set(CMAKE_POLICY_DEFAULT_CMP0077 NEW)

set(EMSCRIPTEN_ROOT ${EMSDK})
if(NOT EMSCRIPTEN_ROOT)
  set(EMSCRIPTEN_ROOT /usr/lib/emscripten)
endif()

set(EMSCRIPTEN_ROOT
    "${EMSCRIPTEN_ROOT}"
    CACHE PATH "Emscripten path")

set(CMAKE_TOOLCHAIN_FILE
    ${EMSCRIPTEN_ROOT}/cmake/Modules/Platform/Emscripten.cmake
    CACHE FILEPATH "Emscripten toolchain file")

project(pfft-ng.wasm)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_EXTENSIONS OFF)

set(headers_simd_f32
    pffft/simd/pf_float.h pffft/simd/pf_sse1_float.h
    pffft/simd/pf_altivec_float.h pffft/simd/pf_neon_float.h
    pffft/simd/pf_scalar_float.h)

set(headers_simd_f64 pffft/simd/pf_double.h pffft/simd/pf_avx_double.h
                     pffft/simd/pf_sse2_double.h pffft/simd/pf_scalar_double.h)

set(sources_f32 pffft/pffft.c pffft/pffft.h ${headers_simd_float})
set(sources_f64 pffft/pffft_double.c pffft/pffft_double.h
                ${headers_simd_double})
set(sources_common pffft/pffft_priv_impl.h pffft/pffft_common.c)

set(exported_functions_f32
    _pffft_new_setup
    _pffft_destroy_setup
    _pffft_transform
    _pffft_transform_ordered
    _pffft_zreorder
    _pffft_zconvolve_accumulate
    _pffft_zconvolve_no_accu
    _pffft_simd_size
    _pffft_simd_arch
    _pffft_min_fft_size
    _pffft_is_valid_size
    _pffft_nearest_transform_size
    _pffft_aligned_malloc
    _pffft_aligned_free)

string(REPLACE _pffft_ _pffftd_ exported_functions_f64
               "${exported_functions_f32}")

include_directories(BEFORE SYSTEM compat)
add_compile_options(-Wall -Wextra -Werror -Wno-unused-parameter -flto -msimd128)
add_compile_definitions(_USE_MATH_DEFINES)
add_link_options(--no-entry -sSTRICT -sNO_ASSERTIONS -sNO_FILESYSTEM
                 -sMALLOC=emmalloc -flto)

add_executable(pffft-ng-f32 ${sources_f32} ${sources_common})
target_compile_options(pffft-ng-f32 PRIVATE -msse)
target_compile_definitions(pffft-ng-f32 PRIVATE _M_X64)

string(JOIN "," exported_functions_f32_arg ${exported_functions_f32})
target_link_options(pffft-ng-f32 PRIVATE
                    -sEXPORTED_FUNCTIONS=${exported_functions_f32_arg})

set_target_properties(pffft-ng-f32 PROPERTIES SUFFIX ".wasm")

add_executable(pffft-ng-f64 ${sources_f64} ${sources_common})
target_compile_options(pffft-ng-f64 PRIVATE -mavx)

string(JOIN "," exported_functions_f64_arg ${exported_functions_f64})
target_link_options(pffft-ng-f64 PRIVATE
                    -sEXPORTED_FUNCTIONS=${exported_functions_f64_arg})

set_target_properties(pffft-ng-f64 PROPERTIES SUFFIX ".wasm")
