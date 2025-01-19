use syn::{ImplItemMethod, ReturnType, Type, Visibility};

/// Extract the type name from a Type
pub fn get_type_name(ty: &Type) -> String {
    if let Type::Path(type_path) = ty {
        type_path
            .path
            .segments
            .last()
            .map(|seg| seg.ident.to_string())
            .unwrap_or_else(|| "UnknownType".to_string())
    } else {
        "UnknownType".to_string()
    }
}

/// Helper to check if a method is a valid constructor
pub fn is_valid_constructor(expected_sig: &str, method: &ImplItemMethod) -> bool {
    method.sig.ident == expected_sig
        && method.sig.inputs.is_empty()
        && matches!(method.vis, Visibility::Public(_))
        && matches!(method.sig.output, ReturnType::Type(_, _))
}

/// Helper to check if a method should be exported
pub fn should_export_method(method: &ImplItemMethod) -> bool {
    if !matches!(method.vis, Visibility::Public(_)) {
        return false;
    }

    method
        .sig
        .inputs
        .iter()
        .next()
        .map_or(false, |arg| matches!(arg, syn::FnArg::Receiver(_)))
}
