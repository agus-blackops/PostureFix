Pod::Spec.new do |s|
  s.name           = 'Headphones'
  s.version        = '1.0.1'
  s.summary        = 'Headphone route detection for PostureFix'
  s.description    = 'Reports whether audio is currently routed to headphones.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
